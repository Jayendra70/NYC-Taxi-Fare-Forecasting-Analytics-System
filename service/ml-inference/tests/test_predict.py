"""
Smoke tests for POST /predict against the stand-in model from conftest.py.

They catch the bug that broke the service before: main.py used a hardcoded
feature list that did not match what notebook 02 trains on.
"""
from fastapi.testclient import TestClient

import main
from features import NOTEBOOK_02_FEATURES

client = TestClient(main.app)

TRIP = {
    "PULocationID": 161,   # Midtown Center, Manhattan
    "DOLocationID": 236,   # Upper East Side North, Manhattan
    "trip_miles": 2.1,
    "trip_time": 900,
    "request_hour": 11,
    "is_weekend": 0,
    "temp": 12.0,
}


def test_service_uses_the_models_own_feature_order():
    assert main.MODEL_FEATURES == NOTEBOOK_02_FEATURES


def test_predict_returns_a_fare_with_breakdown():
    response = client.post("/predict", json=TRIP)
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["predicted_fare"] >= 3.00
    surcharges = body["breakdown"]["surcharges"]
    assert body["predicted_fare"] == round(body["breakdown"]["base_prediction"] + surcharges["total_surcharges"], 2)


def test_manhattan_to_jfk_is_the_70_dollar_flat_fare():
    trip = dict(TRIP, DOLocationID=132, trip_miles=17.0, trip_time=2700)
    body = client.post("/predict", json=trip).json()
    assert body["breakdown"]["base_prediction"] == 70.00


def test_rejects_zone_outside_tlc_range():
    response = client.post("/predict", json=dict(TRIP, PULocationID=999))
    assert response.status_code == 422
