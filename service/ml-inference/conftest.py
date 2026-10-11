"""
Test set-up for the inference service.

The real model (production_taxi_master_model_2024.joblib) is too large for git,
so the tests train a tiny stand-in XGBoost model on synthetic trips with the
exact 25 features notebook 02 uses, and point TAXI_MODEL_PATH at it before
main.py is imported. That checks the service end to end (feature order,
surcharges, response shape) without the real artifact.
"""
import os
import sys
import tempfile
from pathlib import Path

import numpy as np
import pandas as pd
import xgboost as xgb

SERVICE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SERVICE_DIR))

from features import NOTEBOOK_02_FEATURES  # noqa: E402


def _train_stand_in_model(path):
    rng = np.random.default_rng(0)
    n = 2000
    miles = rng.uniform(0.3, 20, n)
    seconds = miles / rng.uniform(5, 30, n) * 3600
    X = pd.DataFrame(0.0, index=range(n), columns=NOTEBOOK_02_FEATURES)
    X["trip_miles"] = miles
    X["trip_time"] = seconds
    X["request_hour"] = rng.integers(0, 24, n)
    X["is_weekend"] = rng.integers(0, 2, n)
    X["temp"] = rng.uniform(-5, 33, n)
    X["implied_speed_mph"] = np.clip(miles / seconds * 3600, 0, 75)
    X["PU_Borough_Manhattan"] = 1.0
    X["DO_Borough_Manhattan"] = 1.0
    fare = 3.0 + 0.7 * np.maximum(5 * miles, seconds / 60)
    X["historical_route_fare"] = fare + rng.normal(0, 1, n)
    model = xgb.XGBRegressor(n_estimators=30, max_depth=3, random_state=0)
    model.fit(X, fare)
    import joblib
    joblib.dump(model, path)


if "TAXI_MODEL_PATH" not in os.environ:
    _model_path = Path(tempfile.mkdtemp()) / "stand_in_model.joblib"
    _train_stand_in_model(_model_path)
    os.environ["TAXI_MODEL_PATH"] = str(_model_path)
