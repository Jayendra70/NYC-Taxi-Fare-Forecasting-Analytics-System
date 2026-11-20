"""End-to-end tests for the HTTP API, run against the stand-in model from conftest.py."""
from fastapi.testclient import TestClient

import main
from features import FEATURES

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


def test_health_reports_the_loaded_model():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["features"] == len(FEATURES)


def test_service_uses_the_models_own_feature_order():
    assert main.MODEL_FEATURES == FEATURES


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


def test_unknown_route_falls_back_to_the_meter_estimate(monkeypatch):
    monkeypatch.setattr(main, "ROUTE_MEANS", {})
    features = main.build_features(main.PredictionRequest(**TRIP))
    assert features["historical_route_fare"].item() == main.synthetic_meter_fare(TRIP["trip_miles"], TRIP["trip_time"])
