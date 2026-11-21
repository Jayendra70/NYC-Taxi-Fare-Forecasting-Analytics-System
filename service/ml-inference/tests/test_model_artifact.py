"""Checks on the committed model, so a retrain that changes the features fails here first."""
import json
from pathlib import Path

import xgboost as xgb

from features import FEATURES

SERVICE_DIR = Path(__file__).resolve().parent.parent


def test_committed_model_uses_the_service_features():
    booster = xgb.Booster()
    booster.load_model(SERVICE_DIR / "model.ubj")
    assert booster.feature_names == FEATURES


def test_route_means_are_keyed_by_pickup_and_dropoff_zone():
    route_means = json.loads((SERVICE_DIR / "route_means.json").read_text())
    assert len(route_means) > 10_000
    for key in list(route_means)[:100]:
        pickup, dropoff = divmod(int(key), 1000)
        assert 1 <= pickup <= 263 and 1 <= dropoff <= 263
