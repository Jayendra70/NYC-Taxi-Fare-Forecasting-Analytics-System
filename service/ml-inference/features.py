"""
Model features, in training order (notebooks/03_training.ipynb).

The service reads the order from the saved model; this list is the fallback
for a model saved without names and the column set the tests' stand-in model
is trained on.
"""

BOROUGHS = ["Bronx", "Brooklyn", "EWR", "Manhattan", "Queens", "Staten Island"]

FEATURES = (
    ["trip_miles", "trip_time", "request_hour", "is_weekend", "is_airport_trip",
     "temp", "precip", "snow", "implied_speed_mph"]
    + [f"PU_Borough_{b}" for b in BOROUGHS]
    + [f"DO_Borough_{b}" for b in BOROUGHS]
    + ["historical_route_fare"]
)
