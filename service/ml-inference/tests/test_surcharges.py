"""Unit tests for the TLC surcharge rules and the synthetic-meter fallback."""
import pytest

from main import calculate_tlc_surcharges, synthetic_meter_fare

MANHATTAN, BROOKLYN, QUEENS = 1, 2, 3
JFK, LGA, NEWARK = 132, 138, 1
MIDTOWN, PARK_SLOPE, ASTORIA = 161, 181, 7


def fees(pu_zone, do_zone, pu_borough, do_borough, hour, weekend=False):
    return calculate_tlc_surcharges(pu_zone, do_zone, pu_borough, do_borough, hour, weekend)


def test_every_trip_pays_mta_and_improvement():
    f = fees(PARK_SLOPE, PARK_SLOPE, BROOKLYN, BROOKLYN, hour=11)
    assert f["mta_and_improvement"] == 1.50
    assert f["total_surcharges"] == 1.50


def test_weekday_rush_hour_is_4_to_8_pm():
    assert fees(PARK_SLOPE, PARK_SLOPE, BROOKLYN, BROOKLYN, hour=16)["time_surcharges"] == 2.50
    assert fees(PARK_SLOPE, PARK_SLOPE, BROOKLYN, BROOKLYN, hour=19)["time_surcharges"] == 2.50
    assert fees(PARK_SLOPE, PARK_SLOPE, BROOKLYN, BROOKLYN, hour=15)["time_surcharges"] == 0.0


def test_no_rush_hour_surcharge_on_weekends():
    assert fees(PARK_SLOPE, PARK_SLOPE, BROOKLYN, BROOKLYN, hour=17, weekend=True)["time_surcharges"] == 0.0


def test_overnight_surcharge_8_pm_to_6_am():
    assert fees(PARK_SLOPE, PARK_SLOPE, BROOKLYN, BROOKLYN, hour=20, weekend=True)["time_surcharges"] == 1.00
    assert fees(PARK_SLOPE, PARK_SLOPE, BROOKLYN, BROOKLYN, hour=5)["time_surcharges"] == 1.00
    assert fees(PARK_SLOPE, PARK_SLOPE, BROOKLYN, BROOKLYN, hour=6)["time_surcharges"] == 0.0


def test_manhattan_congestion_surcharge():
    f = fees(MIDTOWN, PARK_SLOPE, MANHATTAN, BROOKLYN, hour=11)
    assert f["congestion_tolls"] == pytest.approx(3.25)


@pytest.mark.parametrize("pu, do, expected", [
    (JFK, ASTORIA, 2.00),      # JFK pickup
    (ASTORIA, LGA, 5.00),      # LaGuardia drop-off
    (LGA, ASTORIA, 7.00),      # LaGuardia pickup: both fees
    (MIDTOWN, NEWARK, 20.00),  # Newark
])
def test_airport_fees(pu, do, expected):
    assert fees(pu, do, QUEENS, QUEENS, hour=11)["airport_fees"] == expected


def test_manhattan_jfk_rush_hour_uses_the_5_dollar_surcharge():
    f = fees(MIDTOWN, JFK, MANHATTAN, QUEENS, hour=17)
    assert f["time_surcharges"] == 5.00


def test_synthetic_meter_charges_distance_or_time_not_both():
    # Fast trip (24 mph): 3 miles in 7.5 minutes -> distance units dominate.
    assert synthetic_meter_fare(3.0, 7.5 * 60) == pytest.approx(3.00 + 0.70 * 15)
    # Crawl (6 mph): 1 mile in 10 minutes -> time units dominate.
    assert synthetic_meter_fare(1.0, 10 * 60) == pytest.approx(3.00 + 0.70 * 10)
