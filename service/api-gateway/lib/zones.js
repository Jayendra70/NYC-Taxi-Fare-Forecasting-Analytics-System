const fs = require('fs');
const path = require('path');
const turf = require('@turf/turf');

const GEOJSON_PATH = path.join(__dirname, '..', 'nyc_taxi_zones.geojson');

// TLC zone polygons with a precomputed bounding box, so most zones are
// ruled out with four comparisons before the point-in-polygon test.
const zones = JSON.parse(fs.readFileSync(GEOJSON_PATH, 'utf8')).features.map((feature) => ({
  id: Number(feature.properties.location_id),
  name: feature.properties.zone,
  borough: feature.properties.borough,
  bbox: turf.bbox(feature),
  feature,
}));

function findZone(lat, lng) {
  const point = turf.point([lng, lat]);
  const match = zones.find(({ bbox: [minLng, minLat, maxLng, maxLat], feature }) =>
    lng >= minLng && lng <= maxLng && lat >= minLat && lat <= maxLat &&
    turf.booleanPointInPolygon(point, feature));
  return match ? { id: match.id, name: match.name, borough: match.borough } : null;
}

module.exports = { findZone };
