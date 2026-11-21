const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const axios = require('axios');

const { findZone } = require('./lib/zones');
const { getRoute } = require('./lib/route');
const { getWeather, nycClock } = require('./lib/conditions');

const ML_SERVICE_URL = process.env.PYTHON_MICROSERVICE_URL || 'http://127.0.0.1:8000';
const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*';

const app = express();
app.set('trust proxy', 1);
app.use(cors({ origin: ALLOWED_ORIGINS }));
app.use(express.json());

const isLatitude = (v) => typeof v === 'number' && v >= -90 && v <= 90;
const isLongitude = (v) => typeof v === 'number' && v >= -180 && v <= 180;
const round = (value, digits = 2) => Math.round(value * 10 ** digits) / 10 ** digits;

app.get('/health', async (req, res) => {
  try {
    const { data } = await axios.get(`${ML_SERVICE_URL}/health`, { timeout: 5000 });
    res.json({ status: 'ok', mlService: data.status });
  } catch {
    res.status(503).json({ status: 'degraded', mlService: 'unreachable' });
  }
});

app.get('/zone', (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  if (!isLatitude(lat) || !isLongitude(lng) || req.query.lat === undefined || req.query.lng === undefined) {
    return res.status(400).json({ error: 'lat and lng query parameters are required.' });
  }
  const zone = findZone(lat, lng);
  if (!zone) return res.status(404).json({ error: 'That point is outside the NYC taxi zones.' });
  res.json(zone);
});

app.post('/predict', rateLimit({ windowMs: 60 * 1000, limit: 30 }), async (req, res) => {
  const { puLat, puLng, doLat, doLng } = req.body ?? {};
  if (![puLat, doLat].every(isLatitude) || ![puLng, doLng].every(isLongitude)) {
    return res.status(400).json({ error: 'puLat, puLng, doLat and doLng must be numbers.' });
  }

  const pickupZone = findZone(puLat, puLng);
  const dropoffZone = findZone(doLat, doLng);
  if (!pickupZone || !dropoffZone) {
    return res.status(400).json({ error: 'Pickup and drop-off must both be inside New York City.' });
  }

  const [route, weather] = await Promise.all([
    getRoute({ lat: puLat, lng: puLng }, { lat: doLat, lng: doLng }, GOOGLE_API_KEY),
    getWeather(),
  ]);
  const clock = nycClock();

  const trip = {
    PULocationID: pickupZone.id,
    DOLocationID: dropoffZone.id,
    trip_miles: route.miles,
    trip_time: route.seconds,
    request_hour: clock.hour,
    is_weekend: clock.isWeekend ? 1 : 0,
    temp: weather.temp,
    precip: weather.precip,
    snow: weather.snow,
  };

  try {
    const { data } = await axios.post(`${ML_SERVICE_URL}/predict`, trip, { timeout: 8000 });
    res.json({
      predicted_fare: data.predicted_fare,
      breakdown: data.breakdown,
      tolls: round(route.tolls),
      trip: {
        pickup: pickupZone,
        dropoff: dropoffZone,
        miles: round(route.miles, 1),
        minutes: Math.round(route.seconds / 60),
        route_source: route.source,
      },
      conditions: {
        temp_c: weather.temp,
        precip_mm: weather.precip,
        hour: clock.hour,
        is_weekend: clock.isWeekend,
      },
    });
  } catch (error) {
    console.error('ML service request failed:', error.response?.data || error.message);
    res.status(502).json({ error: 'The prediction service is unavailable. Try again in a minute.' });
  }
});

module.exports = app;
