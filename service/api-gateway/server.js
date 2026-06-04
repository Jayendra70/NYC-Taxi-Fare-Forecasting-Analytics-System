require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const turf = require('@turf/turf');

const app = express();
app.use(cors());
app.use(express.json());

const PYTHON_URL = process.env.PYTHON_MICROSERVICE_URL || 'http://127.0.0.1:8000';
const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

let tlcZones;
try {
    tlcZones = JSON.parse(fs.readFileSync(path.join(__dirname, 'nyc_taxi_zones.geojson'), 'utf8'));
} catch (error) {
    console.warn("⚠️ Geo-Fencing disabled. Map file missing.");
}

const isPointInNYC = (lng, lat) => {
    if (!tlcZones) return true; 
    const point = turf.point([lng, lat]);
    return tlcZones.features.some(feature => turf.booleanPointInPolygon(point, feature));
};

app.post('/predict', async (req, res) => {
    try {
        const { puLat, puLng, doLat, doLng, ...restOfPayload } = req.body;

        if (!puLat || !puLng || !doLat || !doLng) {
            return res.status(400).json({ error: 'Missing coordinate fields.' });
        }

        if (!isPointInNYC(puLng, puLat) || !isPointInNYC(doLng, doLat)) {
            return res.status(400).json({ error: 'Locations must be within New York City limits.' });
        }

        let finalPayload = { ...restOfPayload };
        let tripTollCost = 0.0;

        try {
            if (GOOGLE_API_KEY) {
                const googleUrl = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${puLat},${puLng}&destinations=${doLat},${doLng}&departure_time=now&key=${GOOGLE_API_KEY}`;
                const mapRes = await axios.get(googleUrl, { timeout: 4000 });
                if (mapRes.data.status === 'OK' && mapRes.data.rows[0].elements[0].status === 'OK') {
                    const trafficData = mapRes.data.rows[0].elements[0];
                    finalPayload.trip_miles = trafficData.distance.value / 1609.34;
                    finalPayload.trip_time = trafficData.duration_in_traffic ? trafficData.duration_in_traffic.value : trafficData.duration.value;
                }
            }
        } catch (e) {
            console.warn("⚠️ Traffic API failed. Reason:", e.response ? e.response.data : e.message);                   //////
}

        const nycDate = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
        finalPayload.request_hour = nycDate.getHours();
        finalPayload.is_weekend = (nycDate.getDay() === 0 || nycDate.getDay() === 6) ? 1 : 0;

        try {
            const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=40.7128&longitude=-74.0060&current=temperature_2m,precipitation,snowfall&timezone=America%2FNew_York`;
            const weatherRes = await axios.get(weatherUrl, { timeout: 3000 });
            finalPayload.temp = weatherRes.data.current.temperature_2m;
            finalPayload.precip = weatherRes.data.current.precipitation;
            finalPayload.snow = weatherRes.data.current.snowfall;
        } catch(e) {
             finalPayload.temp = 65;
             finalPayload.precip = 0.0;
             finalPayload.snow = 0.0;
        }

        const pythonResponse = await axios.post(`${PYTHON_URL}/predict`, finalPayload, { timeout: 8000 });          ///////
        res.json(pythonResponse.data);

    } catch (error) {
        console.error('Gateway Error:', error.message);
        res.status(500).json({ error: 'Prediction engine is temporarily unavailable.' });
    }
});

app.listen(5001, () => console.log(`🚀 API Gateway running on http://localhost:5001`));