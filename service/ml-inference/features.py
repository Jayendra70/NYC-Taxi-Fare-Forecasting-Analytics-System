"""
The 25 features notebooks/02_full_year_model_training.ipynb trains on, in order.

main.py reads the feature order from the trained model itself
(feature_names_in_); this list is the fallback for a model saved without
feature names, and the source of truth for the tests' stand-in model.
"""

BOROUGHS = ['Bronx', 'Brooklyn', 'EWR', 'Manhattan', 'Queens', 'Staten Island']

NOTEBOOK_02_FEATURES = (
    [
        'trip_miles', 'trip_time',
        'shared_match_flag', 'wav_match_flag', 'access_a_ride_flag',
        'request_hour', 'is_weekend', 'is_airport_trip', 'temp', 'precip', 'snow',
        'implied_speed_mph',
    ]
    + [f'PU_Borough_{b}' for b in BOROUGHS]
    + [f'DO_Borough_{b}' for b in BOROUGHS]
    + ['historical_route_fare']
)
