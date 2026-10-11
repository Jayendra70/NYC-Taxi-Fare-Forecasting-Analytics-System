"""
NYC Taxi Fare Prediction — ML Inference Service (Speed-Optimized)

Loads the XGBoost model exported by notebooks/02_full_year_model_training.ipynb
and serves POST /predict. The feature order is read from the trained model
itself (feature_names_in_), so the service and the notebook cannot drift apart.

Model path: production_taxi_master_model_2024.joblib next to this file, or set
TAXI_MODEL_PATH. The model is not committed (too large for git); see the README.
"""
import logging
import os
from pathlib import Path
import json
import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException # type: ignore
from fastapi.middleware.cors import CORSMiddleware # type: ignore
from pydantic import BaseModel, Field # type: ignore

from features import BOROUGHS, NOTEBOOK_02_FEATURES

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)-7s | %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(title="NYC Taxi Fare Prediction Microservice", version="3.2.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = Path(os.getenv("TAXI_MODEL_PATH", str(BASE_DIR / "production_taxi_master_model_2024.joblib")))


try:
    model = joblib.load(MODEL_PATH)

    # Ask the model which columns, in which order, it was trained on. The old
    # hardcoded list added PULocationID/DOLocationID, which notebook 02 never
    # trains on, so XGBoost rejected every request with a feature_names mismatch.
    trained_on = getattr(model, "feature_names_in_", None)
    MODEL_FEATURES = [str(c) for c in trained_on] if trained_on is not None else NOTEBOOK_02_FEATURES

    zones_df = pd.read_csv(BASE_DIR / "data" / "dim_localizacao.csv")
    zones_df.rename(columns={"localizacao_id": "LocationID", "bairro": "Borough"}, inplace=True)

    BOROUGH_MAPPING = {"Manhattan": 1, "Brooklyn": 2, "Queens": 3, "Bronx": 4, "Staten Island": 5, "EWR": 6, "Unknown": 0}
    ID_TO_BOROUGH = {v: k for k, v in BOROUGH_MAPPING.items()}
    zones_df["Borough_ID"] = zones_df["Borough"].map(BOROUGH_MAPPING).fillna(0).astype(int)
    ZONE_TO_BOROUGH = dict(zip(zones_df["LocationID"], zones_df["Borough_ID"]))

    try:
        with open(BASE_DIR / 'route_means.json', 'r') as f:
            route_means = json.load(f)
    except FileNotFoundError:
        route_means = {}

    logger.info("✅ Model loaded from %s (%d features) and artifacts ready.", MODEL_PATH, len(MODEL_FEATURES))
except Exception as exc:
    logger.critical("Failed to load model artifacts: %s", exc)
    raise RuntimeError(f"Failed to load critical artifacts: {exc}") from exc


class PredictionRequest(BaseModel):
    PULocationID: int = Field(..., ge=1, le=263)
    DOLocationID: int = Field(..., ge=1, le=263)
    trip_miles: float = Field(..., ge=0, le=200)
    trip_time: float = Field(..., ge=0)
    shared_match_flag: int = Field(0, ge=0, le=1)
    wav_match_flag: int = Field(0, ge=0, le=1)
    access_a_ride_flag: int = Field(0, ge=0, le=1)
    wait_time_mins: float = Field(0, ge=0)
    request_hour: int = Field(..., ge=0, le=23)
    is_weekend: int = Field(..., ge=0, le=1)
    is_airport_trip: int = Field(0, ge=0, le=1)
    temp: float = Field(...)
    precip: float = Field(0, ge=0)
    snow: float = Field(0, ge=0)
    snowdepth: float = Field(0, ge=0)
    visibility: float = Field(10.0, ge=0)
    windspeed: float = Field(0, ge=0)


class SurchargeBreakdown(BaseModel):
    mta_and_improvement: float
    airport_fees: float
    time_surcharges: float
    congestion_tolls: float
    total_surcharges: float


class FareBreakdown(BaseModel):
    base_prediction: float
    surcharges: SurchargeBreakdown


class PredictionResponse(BaseModel):
    success: bool
    breakdown: FareBreakdown
    predicted_fare: float
    currency: str = "USD"


# --- OFFICIAL TLC BUSINESS LOGIC ---
JFK_ZONE = 132
LGA_ZONE = 138
NEWARK_ZONE = 1
MANHATTAN_BOROUGH_ID = 1

def calculate_tlc_surcharges(pu_zone: int, do_zone: int, pu_borough: int, do_borough: int, hour: int, is_weekend: bool):
    mta_imp = 1.50
    airport = 0.0
    time_fee = 0.0
    congestion = 0.0

    is_rush = 16 <= hour < 20 and not is_weekend
    is_overnight = hour >= 20 or hour < 6
    is_manhattan_jfk = ((pu_borough == MANHATTAN_BOROUGH_ID and do_zone == JFK_ZONE) or (pu_zone == JFK_ZONE and do_borough == MANHATTAN_BOROUGH_ID))

    if pu_zone in {JFK_ZONE, LGA_ZONE}: airport += 2.00
    if pu_zone == LGA_ZONE or do_zone == LGA_ZONE: airport += 5.00
    if pu_zone == NEWARK_ZONE or do_zone == NEWARK_ZONE: airport += 20.00

    if is_rush:
        time_fee += 5.00 if is_manhattan_jfk else 2.50
    elif is_overnight and not is_manhattan_jfk:
        time_fee += 1.00

    if pu_borough == MANHATTAN_BOROUGH_ID or do_borough == MANHATTAN_BOROUGH_ID:
        congestion += 2.50
        congestion += 0.75

    return {
        "mta_and_improvement": mta_imp,
        "airport_fees": airport,
        "time_surcharges": time_fee,
        "congestion_tolls": congestion,
        "total_surcharges": mta_imp + airport + time_fee + congestion
    }


def synthetic_meter_fare(trip_miles: float, trip_time_seconds: float) -> float:
    """Deterministic TLC-meter estimate for routes with no fare history.

    The meter charges $0.70 per 1/5 mile while the cab moves faster than
    12 mph and $0.70 per minute while it is slower, never both at once, so the
    units are roughly max(5 x miles, minutes). The old fallback added the full
    time charge on top of the full distance charge for slow trips: on Jan 2024
    trips it missed by $5.18 on average, against $2.63 for this version
    (notebooks/03_baselines_and_input_error.ipynb).
    """
    minutes = trip_time_seconds / 60.0
    return 3.00 + 0.70 * max(5.0 * trip_miles, minutes)


@app.post("/predict", response_model=PredictionResponse)
def predict_fare(payload: PredictionRequest):
    try:
        input_data = payload.model_dump()
        pu_zone, do_zone = input_data["PULocationID"], input_data["DOLocationID"]
        hour, is_wknd = input_data["request_hour"], input_data["is_weekend"] == 1

        if input_data["trip_time"] > 0:
            speed = (input_data["trip_miles"] / input_data["trip_time"]) * 3600
            input_data["implied_speed_mph"] = min(75.0, max(0.0, speed))
        else:
            input_data["implied_speed_mph"] = 0.0

        pu_borough_id = ZONE_TO_BOROUGH.get(pu_zone, 0)
        do_borough_id = ZONE_TO_BOROUGH.get(do_zone, 0)
        pu_borough_name = ID_TO_BOROUGH.get(pu_borough_id, "Unknown")
        do_borough_name = ID_TO_BOROUGH.get(do_borough_id, "Unknown")

        input_data["is_airport_trip"] = 1 if (pu_zone in {132, 138, 1} or do_zone in {132, 138, 1}) else 0

        for b in BOROUGHS:
            input_data[f'PU_Borough_{b}'] = 1.0 if pu_borough_name == b else 0.0
            input_data[f'DO_Borough_{b}'] = 1.0 if do_borough_name == b else 0.0

        route_id_str = str((pu_zone * 1000) + do_zone)

        # --- THE SYNTHETIC METER (Dynamic Fallback for Sparse Routes) ---
        if route_id_str in route_means:
            historical_val = route_means[route_id_str]
        else:
            historical_val = synthetic_meter_fare(input_data["trip_miles"], input_data["trip_time"])

        input_data['historical_route_fare'] = historical_val

        missing = [c for c in MODEL_FEATURES if c not in input_data]
        if missing:
            raise ValueError(f"Model expects features the service does not build: {missing}")

        # Enforce exact column order required by XGBoost
        df_input = pd.DataFrame([input_data]).reindex(columns=MODEL_FEATURES)
        base_ml_fare = float(model.predict(df_input)[0])

        base_fare = max(3.00, base_ml_fare)

        is_manhattan_jfk = ((pu_borough_id == MANHATTAN_BOROUGH_ID and do_zone == JFK_ZONE) or (pu_zone == JFK_ZONE and do_borough_id == MANHATTAN_BOROUGH_ID))
        if is_manhattan_jfk: base_fare = 70.00

        surcharges = calculate_tlc_surcharges(pu_zone, do_zone, pu_borough_id, do_borough_id, hour, is_wknd)
        final_fare = base_fare + surcharges["total_surcharges"]

        return PredictionResponse(
            success=True,
            breakdown=FareBreakdown(
                base_prediction=round(base_fare, 2),
                surcharges=SurchargeBreakdown(**{k: round(v, 2) for k, v in surcharges.items()})
            ),
            predicted_fare=round(final_fare, 2),
        )

    except Exception as exc:
        logger.error("Inference failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Inference error: {exc}") from exc
