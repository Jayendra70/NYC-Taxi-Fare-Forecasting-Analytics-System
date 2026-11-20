"""
Fare inference service.

POST /predict takes a trip (TLC zones, distance, duration, time and weather),
builds the model's features, runs XGBoost for the metered base fare and adds
the TLC surcharges on top. The feature order comes from the trained model
itself, so the service always matches whatever the training notebook exported.
"""
import json
import logging
import os
from pathlib import Path

import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from features import BOROUGHS, FEATURES

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("ml-inference")

BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = Path(os.getenv("TAXI_MODEL_PATH", BASE_DIR / "production_taxi_master_model_2024.joblib"))
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*").split(",")

JFK_ZONE, LGA_ZONE, NEWARK_ZONE = 132, 138, 1
AIRPORT_ZONES = {JFK_ZONE, LGA_ZONE, NEWARK_ZONE}
MANHATTAN = "Manhattan"
MINIMUM_FARE = 3.00
JFK_FLAT_FARE = 70.00

app = FastAPI(title="NYC Taxi Fare Inference", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=ALLOWED_ORIGINS, allow_methods=["GET", "POST"], allow_headers=["*"])


def load_zone_boroughs() -> dict[int, str]:
    zones = pd.read_csv(BASE_DIR / "data" / "dim_localizacao.csv")
    return zones.set_index("localizacao_id")["bairro"].to_dict()


def load_route_means() -> dict[str, float]:
    path = BASE_DIR / "route_means.json"
    if not path.exists():
        logger.warning("route_means.json not found; every route will use the meter fallback")
        return {}
    return json.loads(path.read_text())


model = joblib.load(MODEL_PATH)
# A model saved with feature names knows its own column order; fall back to
# the list in features.py for one that was not.
trained_on = getattr(model, "feature_names_in_", None)
MODEL_FEATURES = [str(c) for c in trained_on] if trained_on is not None else FEATURES
ZONE_TO_BOROUGH = load_zone_boroughs()
ROUTE_MEANS = load_route_means()
logger.info("Loaded model from %s (%d features, %d routes)", MODEL_PATH, len(MODEL_FEATURES), len(ROUTE_MEANS))


class PredictionRequest(BaseModel):
    PULocationID: int = Field(..., ge=1, le=263)
    DOLocationID: int = Field(..., ge=1, le=263)
    trip_miles: float = Field(..., ge=0, le=200)
    trip_time: float = Field(..., ge=0, description="Trip duration in seconds")
    request_hour: int = Field(..., ge=0, le=23)
    is_weekend: int = Field(..., ge=0, le=1)
    temp: float = Field(..., description="Temperature in °C")
    precip: float = Field(0, ge=0, description="Precipitation in mm over the past hour")
    snow: float = Field(0, ge=0, description="Snowfall in cm over the past hour")
    shared_match_flag: int = Field(0, ge=0, le=1)
    wav_match_flag: int = Field(0, ge=0, le=1)
    access_a_ride_flag: int = Field(0, ge=0, le=1)


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


def is_manhattan_jfk(pu_zone: int, do_zone: int, pu_borough: str, do_borough: str) -> bool:
    return (pu_borough == MANHATTAN and do_zone == JFK_ZONE) or (pu_zone == JFK_ZONE and do_borough == MANHATTAN)


def calculate_tlc_surcharges(pu_zone: int, do_zone: int, pu_borough: str, do_borough: str,
                             hour: int, is_weekend: bool) -> dict[str, float]:
    """Fixed TLC extras added on top of the metered fare."""
    mta_and_improvement = 1.50  # $0.50 MTA tax + $1.00 improvement surcharge
    airport = 0.0
    time_fee = 0.0
    congestion = 0.0
    flat_jfk = is_manhattan_jfk(pu_zone, do_zone, pu_borough, do_borough)

    if pu_zone in {JFK_ZONE, LGA_ZONE}:
        airport += 2.00
    if LGA_ZONE in (pu_zone, do_zone):
        airport += 5.00
    if NEWARK_ZONE in (pu_zone, do_zone):
        airport += 20.00

    rush_hour = 16 <= hour < 20 and not is_weekend
    overnight = hour >= 20 or hour < 6
    if rush_hour:
        time_fee = 5.00 if flat_jfk else 2.50
    elif overnight and not flat_jfk:
        time_fee = 1.00

    if MANHATTAN in (pu_borough, do_borough):
        congestion = 2.50 + 0.75  # NYS congestion surcharge + MTA congestion relief charge

    return {
        "mta_and_improvement": mta_and_improvement,
        "airport_fees": airport,
        "time_surcharges": time_fee,
        "congestion_tolls": congestion,
        "total_surcharges": mta_and_improvement + airport + time_fee + congestion,
    }


def synthetic_meter_fare(trip_miles: float, trip_time_seconds: float) -> float:
    """Meter estimate for routes with no fare history.

    The meter charges $0.70 per 1/5 mile while the cab is faster than 12 mph
    and $0.70 per minute while it is slower, never both, so the billed units
    are roughly max(5 x miles, minutes). On January 2024 trips this misses by
    $2.63 on average (notebooks/03_baselines_and_input_error.ipynb).
    """
    minutes = trip_time_seconds / 60.0
    return MINIMUM_FARE + 0.70 * max(5.0 * trip_miles, minutes)


def build_features(trip: PredictionRequest) -> pd.DataFrame:
    row = trip.model_dump()
    pu_zone, do_zone = trip.PULocationID, trip.DOLocationID
    pu_borough = ZONE_TO_BOROUGH.get(pu_zone, "Unknown")
    do_borough = ZONE_TO_BOROUGH.get(do_zone, "Unknown")

    speed = trip.trip_miles / trip.trip_time * 3600 if trip.trip_time > 0 else 0.0
    row["implied_speed_mph"] = min(75.0, max(0.0, speed))
    row["is_airport_trip"] = int(pu_zone in AIRPORT_ZONES or do_zone in AIRPORT_ZONES)
    for borough in BOROUGHS:
        row[f"PU_Borough_{borough}"] = float(pu_borough == borough)
        row[f"DO_Borough_{borough}"] = float(do_borough == borough)

    route_id = str(pu_zone * 1000 + do_zone)
    if route_id in ROUTE_MEANS:
        row["historical_route_fare"] = ROUTE_MEANS[route_id]
    else:
        row["historical_route_fare"] = synthetic_meter_fare(trip.trip_miles, trip.trip_time)

    missing = [c for c in MODEL_FEATURES if c not in row]
    if missing:
        raise ValueError(f"model expects features the service does not build: {missing}")
    return pd.DataFrame([row]).reindex(columns=MODEL_FEATURES)


@app.get("/health")
def health():
    return {"status": "ok", "features": len(MODEL_FEATURES), "routes": len(ROUTE_MEANS)}


@app.post("/predict", response_model=PredictionResponse)
def predict_fare(trip: PredictionRequest):
    pu_zone, do_zone = trip.PULocationID, trip.DOLocationID
    pu_borough = ZONE_TO_BOROUGH.get(pu_zone, "Unknown")
    do_borough = ZONE_TO_BOROUGH.get(do_zone, "Unknown")

    try:
        base_fare = max(MINIMUM_FARE, float(model.predict(build_features(trip))[0]))
    except Exception:
        logger.exception("Inference failed for %s", trip.model_dump())
        raise HTTPException(status_code=500, detail="Inference failed") from None

    if is_manhattan_jfk(pu_zone, do_zone, pu_borough, do_borough):
        base_fare = JFK_FLAT_FARE

    surcharges = calculate_tlc_surcharges(pu_zone, do_zone, pu_borough, do_borough,
                                          trip.request_hour, trip.is_weekend == 1)
    return PredictionResponse(
        success=True,
        breakdown=FareBreakdown(
            base_prediction=round(base_fare, 2),
            surcharges=SurchargeBreakdown(**{k: round(v, 2) for k, v in surcharges.items()}),
        ),
        predicted_fare=round(base_fare + surcharges["total_surcharges"], 2),
    )
