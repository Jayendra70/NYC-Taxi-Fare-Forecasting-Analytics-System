"""Loading and cleaning helpers shared by the notebooks."""
from pathlib import Path

import pandas as pd
import requests

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "notebooks" / "data"  # downloads; ignored by git
PLOTS_DIR = ROOT / "notebooks" / "plots"
SERVICE_DIR = ROOT / "service" / "ml-inference"  # where the API loads the model from
ZONES_CSV = SERVICE_DIR / "data" / "taxi_zones.csv"

TRIP_URL = "https://d37ci6vzurychx.cloudfront.net/trip-data/yellow_tripdata_2024-{month:02d}.parquet"
WEATHER_URL = (
    "https://archive-api.open-meteo.com/v1/archive?latitude=40.7128&longitude=-74.0060"
    "&start_date=2024-01-01&end_date=2024-12-31"
    "&hourly=temperature_2m,precipitation,snowfall&timezone=America%2FNew_York"
)
AIRPORT_ZONES = [132, 138, 1]  # JFK, LaGuardia, Newark
TRIP_COLUMNS = ["tpep_pickup_datetime", "tpep_dropoff_datetime", "trip_distance",
                "fare_amount", "PULocationID", "DOLocationID"]


def trip_file(month: int) -> Path:
    """Path to one month of 2024 yellow-taxi trips, downloading it (~55 MB) if needed."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    path = DATA_DIR / f"yellow_tripdata_2024-{month:02d}.parquet"
    if not path.exists():
        print(f"Downloading {path.name}...")
        with requests.get(TRIP_URL.format(month=month), stream=True, timeout=60) as response:
            response.raise_for_status()
            with open(path, "wb") as f:
                f.writelines(response.iter_content(chunk_size=1 << 20))
    return path


def load_zones() -> pd.DataFrame:
    return pd.read_csv(ZONES_CSV)


def load_hourly_weather() -> pd.DataFrame:
    """Hourly 2024 NYC weather from the Open-Meteo archive.

    Same variables and units as the gateway's live call: temperature (°C),
    precipitation (mm in the past hour) and snowfall (cm).
    """
    path = DATA_DIR / "weather_hourly_2024.csv"
    if not path.exists():
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        response = requests.get(WEATHER_URL, timeout=120)
        response.raise_for_status()
        hourly = response.json()["hourly"]
        pd.DataFrame({
            "hour": hourly["time"],
            "temp": hourly["temperature_2m"],
            "precip": hourly["precipitation"],
            "snow": hourly["snowfall"],
        }).to_csv(path, index=False)

    weather = pd.read_csv(path, parse_dates=["hour"])
    weather["hour"] = weather["hour"].astype("datetime64[ns]")
    weather = weather.drop_duplicates("hour").sort_values("hour").ffill()
    weather[["temp", "precip", "snow"]] = weather[["temp", "precip", "snow"]].astype("float32")
    return weather


def load_trips(month: int, zones: pd.DataFrame, weather: pd.DataFrame,
               sample_fraction: float = 1.0, random_state: int = 42) -> pd.DataFrame:
    """One month of cleaned trips with the model's features (borough names not yet one-hot encoded).

    Keeps trips over 0.1 and under 100 miles, between one minute and four
    hours long, with a fare between $2.50 and $400. That drops refunds, test
    rows, GPS glitches and meters left running.
    """
    df = pd.read_parquet(trip_file(month), columns=TRIP_COLUMNS)
    start = pd.Timestamp(2024, month, 1)
    df = df[(df.tpep_pickup_datetime >= start) & (df.tpep_pickup_datetime < start + pd.offsets.MonthBegin())]
    df["trip_time"] = (df.tpep_dropoff_datetime - df.tpep_pickup_datetime).dt.total_seconds()
    df = df.rename(columns={"trip_distance": "trip_miles"})
    df = df[df.trip_miles.between(0.1, 100, inclusive="neither")
            & df.fare_amount.between(2.5, 400, inclusive="neither")
            & df.trip_time.between(60, 4 * 3600, inclusive="neither")]
    if sample_fraction < 1:
        df = df.sample(frac=sample_fraction, random_state=random_state)

    boroughs = zones[["LocationID", "Borough", "Zone"]]
    df = df.merge(boroughs.add_prefix("PU_").rename(columns={"PU_LocationID": "PULocationID"}), on="PULocationID")
    df = df.merge(boroughs.add_prefix("DO_").rename(columns={"DO_LocationID": "DOLocationID"}), on="DOLocationID")

    df["tpep_pickup_datetime"] = df["tpep_pickup_datetime"].astype("datetime64[ns]")
    df = df.sort_values("tpep_pickup_datetime")
    df = pd.merge_asof(df, weather, left_on="tpep_pickup_datetime", right_on="hour", direction="backward")

    df["request_hour"] = df.tpep_pickup_datetime.dt.hour.astype("int8")
    df["is_weekend"] = (df.tpep_pickup_datetime.dt.dayofweek >= 5).astype("int8")
    df["is_airport_trip"] = (df.PULocationID.isin(AIRPORT_ZONES) | df.DOLocationID.isin(AIRPORT_ZONES)).astype("int8")
    df["implied_speed_mph"] = (df.trip_miles / df.trip_time * 3600).clip(0, 75).astype("float32")
    df["route_id"] = (df.PULocationID * 1000 + df.DOLocationID).astype("int32")
    for col in ["fare_amount", "trip_miles", "trip_time"]:
        df[col] = df[col].astype("float32")
    return df.drop(columns=["tpep_dropoff_datetime", "hour"]).reset_index(drop=True)


def one_hot_boroughs(df: pd.DataFrame) -> pd.DataFrame:
    """PU_Borough_<name> / DO_Borough_<name> columns for all six boroughs, matching the API."""
    out = df.copy()
    for borough in sorted(load_zones().Borough.unique()):
        out[f"PU_Borough_{borough}"] = (out.PU_Borough == borough).astype("uint8")
        out[f"DO_Borough_{borough}"] = (out.DO_Borough == borough).astype("uint8")
    return out


def save_plot(fig, name: str) -> None:
    PLOTS_DIR.mkdir(exist_ok=True)
    fig.savefig(PLOTS_DIR / f"{name}.png", dpi=120, bbox_inches="tight")
