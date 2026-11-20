"""
Model features, in training order.

The service reads the order from the trained model (feature_names_in_); this
list is the fallback for a model saved without names and the column set the
tests' stand-in model is trained on.
"""

BOROUGHS = ["Bronx", "Brooklyn", "EWR", "Manhattan", "Queens", "Staten Island"]

FEATURES = (
    [
        "trip_miles", "trip_time",
        "shared_match_flag", "wav_match_flag", "access_a_ride_flag",
        "request_hour", "is_weekend", "is_airport_trip", "temp", "precip", "snow",
        "implied_speed_mph",
    ]
    + [f"PU_Borough_{b}" for b in BOROUGHS]
    + [f"DO_Borough_{b}" for b in BOROUGHS]
    + ["historical_route_fare"]
)
