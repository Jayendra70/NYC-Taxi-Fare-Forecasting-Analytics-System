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

       // [UPGRADE]: Google Routes API with Toll Calculation
        try {
            if (GOOGLE_API_KEY) {
                const routesUrl = 'https://routes.googleapis.com/directions/v2:computeRoutes';
                const routesBody = {
    origin: { location: { latLng: { latitude: puLat, longitude: puLng } } },
    destination: { location: { latLng: { latitude: doLat, longitude: doLng } } },
    travelMode: "DRIVE",
    routingPreference: "TRAFFIC_AWARE",
    extraComputations: ["TOLLS"] // <--- The correct v2 schema
};
                
                // We use a FieldMask to tell Google EXACTLY what data we want back to save bandwidth
                const routesHeaders = {
                    'Content-Type': 'application/json',
                    'X-Goog-Api-Key': GOOGLE_API_KEY,
                    'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration,routes.travelAdvisory.tollInfo'
                };

                const mapRes = await axios.post(routesUrl, routesBody, { headers: routesHeaders, timeout: 10000 });
                const routeData = mapRes.data.routes[0];

                if (routeData) {
                    // 1. Extract Distance & Time
                    finalPayload.trip_miles = routeData.distanceMeters / 1609.34;
                    finalPayload.trip_time = parseInt(routeData.duration.replace('s', '')); 

                    // 2. Extract Tolls (If they exist on this route)
                    if (routeData.travelAdvisory && routeData.travelAdvisory.tollInfo) {
                        const tolls = routeData.travelAdvisory.tollInfo.estimatedPrice;
                        if (tolls && tolls.length > 0) {
                            // Extract the USD toll amount
                            tripTollCost = parseFloat(tolls[0].units || 0) + parseFloat((tolls[0].nanos || 0) / 1000000000);
                            console.log(`🌉 Toll Detected! Cost: $${tripTollCost.toFixed(2)}`);
                        }
                    }
                }
            }
       } catch (e) {
    console.error("❌ Routes API Error Details:", e.response?.data || e.message);
    console.warn("⚠️ Routes API failed. Relying on mathematical estimation.");
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
             // Fallback when Open-Meteo is unreachable. The model was trained on
             // Celsius temperatures (dim_clima), so this must be Celsius too:
             // 13 °C is roughly NYC's annual mean. (It used to send 65, a
             // Fahrenheit value, far outside anything the model saw.)
             finalPayload.temp = 13.0;
             finalPayload.precip = 0.0;
             finalPayload.snow = 0.0;
        }

        const pythonResponse = await axios.post(`${PYTHON_URL}/predict`, finalPayload, { timeout: 8000 });
        
        res.json({
            predicted_fare: pythonResponse.data.predicted_fare,
            breakdown: pythonResponse.data.breakdown,
            tolls: tripTollCost // Sending the toll cost to the frontend!
        });

    } catch (error) {
        console.error('Gateway Error:', error.message);
        res.status(500).json({ error: 'Prediction engine is temporarily unavailable.' });
    }
});

app.listen(5001, () => console.log(`🚀 API Gateway running on http://localhost:5001`));