const axios = require('axios');

const ROUTES_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes';
const METERS_PER_MILE = 1609.34;
const EARTH_RADIUS_MILES = 3958.8;
// Streets are not straight lines: on Manhattan's grid the driven distance is
// about 1.4x the straight-line distance.
const STREET_GRID_FACTOR = 1.4;
// About 16 mph, close to the average yellow-taxi speed in the 2024 data.
const SECONDS_PER_MILE = 220;

const toRadians = (degrees) => (degrees * Math.PI) / 180;

function straightLineMiles(from, to) {
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.sqrt(a));
}

function estimateRoute(from, to) {
  const miles = straightLineMiles(from, to) * STREET_GRID_FACTOR;
  return { miles, seconds: miles * SECONDS_PER_MILE, tolls: 0, source: 'estimate' };
}

async function googleRoute(from, to, apiKey) {
  const toWaypoint = ({ lat, lng }) => ({ location: { latLng: { latitude: lat, longitude: lng } } });
  const response = await axios.post(
    ROUTES_URL,
    {
      origin: toWaypoint(from),
      destination: toWaypoint(to),
      travelMode: 'DRIVE',
      routingPreference: 'TRAFFIC_AWARE',
      extraComputations: ['TOLLS'],
    },
    {
      headers: {
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration,routes.travelAdvisory.tollInfo',
      },
      timeout: 10000,
    },
  );

  const route = response.data.routes?.[0];
  if (!route) return null;

  const price = route.travelAdvisory?.tollInfo?.estimatedPrice?.[0];
  const tolls = price ? Number(price.units || 0) + (price.nanos || 0) / 1e9 : 0;
  return {
    miles: route.distanceMeters / METERS_PER_MILE,
    seconds: parseInt(route.duration, 10), // e.g. "1234s"
    tolls,
    source: 'google',
  };
}

// Traffic-aware route from Google when a key is set, otherwise (or when the
// call fails) a straight-line estimate so a prediction is always possible.
async function getRoute(from, to, apiKey) {
  if (apiKey) {
    try {
      const route = await googleRoute(from, to, apiKey);
      if (route) return route;
    } catch (error) {
      console.warn('Google Routes request failed, using the estimate:', error.response?.data?.error?.message || error.message);
    }
  }
  return estimateRoute(from, to);
}

module.exports = { getRoute, estimateRoute, straightLineMiles };
