const { test, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const axios = require('axios');
const request = require('supertest');

delete process.env.GOOGLE_MAPS_API_KEY;
const app = require('../app');
const { clearWeatherCache } = require('../lib/conditions');
const { estimateRoute } = require('../lib/route');

const ROCKEFELLER = { lat: 40.7587, lng: -73.9787 }; // Midtown Center, zone 161
const JFK = { lat: 40.6413, lng: -73.7781 }; // zone 132
const HOBOKEN = { lat: 40.744, lng: -74.0324 }; // New Jersey, outside the zones

const ML_RESPONSE = {
  success: true,
  predicted_fare: 81.75,
  breakdown: {
    base_prediction: 70,
    surcharges: { mta_and_improvement: 1.5, airport_fees: 0, time_surcharges: 0, congestion_tolls: 3.25, total_surcharges: 4.75 },
  },
};

const tripBody = (from, to) => ({ puLat: from.lat, puLng: from.lng, doLat: to.lat, doLng: to.lng });

beforeEach(() => {
  clearWeatherCache();
  mock.method(axios, 'get', async () => ({
    data: { current: { temperature_2m: 4.2, precipitation: 0.3, snowfall: 0 } },
  }));
});

afterEach(() => mock.restoreAll());

test('GET /zone resolves a point to its TLC zone', async () => {
  const res = await request(app).get('/zone').query(ROCKEFELLER);
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { id: 161, name: 'Midtown Center', borough: 'Manhattan' });
});

test('GET /zone returns 404 outside the taxi zones', async () => {
  const res = await request(app).get('/zone').query(HOBOKEN);
  assert.equal(res.status, 404);
});

test('GET /zone rejects missing coordinates', async () => {
  const res = await request(app).get('/zone');
  assert.equal(res.status, 400);
});

test('POST /predict rejects non-numeric coordinates', async () => {
  const res = await request(app).post('/predict').send({ puLat: '40.7', puLng: -73.9, doLat: 40.6, doLng: -73.7 });
  assert.equal(res.status, 400);
});

test('POST /predict rejects points outside NYC', async () => {
  const res = await request(app).post('/predict').send(tripBody(HOBOKEN, JFK));
  assert.equal(res.status, 400);
});

test('POST /predict sends the resolved zones, route estimate and weather to the ML service', async () => {
  const post = mock.method(axios, 'post', async () => ({ data: ML_RESPONSE }));

  const res = await request(app).post('/predict').send(tripBody(ROCKEFELLER, JFK));

  assert.equal(res.status, 200);
  const [url, trip] = post.mock.calls[0].arguments;
  assert.match(url, /\/predict$/);
  assert.equal(trip.PULocationID, 161);
  assert.equal(trip.DOLocationID, 132);
  assert.equal(trip.temp, 4.2);
  assert.ok(trip.trip_miles > 10 && trip.trip_miles < 20, `unexpected distance ${trip.trip_miles}`);

  assert.equal(res.body.predicted_fare, 81.75);
  assert.equal(res.body.trip.route_source, 'estimate');
  assert.equal(res.body.trip.dropoff.name, 'JFK Airport');
});

test('POST /predict returns 502 when the ML service is down', async () => {
  mock.method(axios, 'post', async () => { throw new Error('connect ECONNREFUSED'); });
  mock.method(console, 'error', () => {});
  const res = await request(app).post('/predict').send(tripBody(ROCKEFELLER, JFK));
  assert.equal(res.status, 502);
});

test('falls back to NYC average weather when Open-Meteo fails', async () => {
  mock.method(axios, 'get', async () => { throw new Error('timeout'); });
  mock.method(console, 'warn', () => {});
  const post = mock.method(axios, 'post', async () => ({ data: ML_RESPONSE }));
  await request(app).post('/predict').send(tripBody(ROCKEFELLER, JFK));
  assert.equal(post.mock.calls[0].arguments[1].temp, 13);
});

test('route estimate scales straight-line distance to street distance', () => {
  const route = estimateRoute(ROCKEFELLER, JFK);
  assert.equal(route.source, 'estimate');
  assert.equal(route.seconds, route.miles * 220);
});
