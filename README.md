# 🚕 NYC Taxi Fare Predictor

**ML-powered fare estimation using XGBoost, live Google Routes traffic data, and real-time NYC weather.**

An end-to-end data science project built on NYC TLC (Taxi & Limousine Commission) 2024 yellow-taxi trip records. Users click pickup and drop-off locations on an interactive map, and the system predicts the total fare by combining an XGBoost regression model with live traffic enrichment from the Google Routes API and official TLC surcharge rules.

[![tests](https://github.com/Jayendra70/NYC-Taxi-Fare-Forecasting-Analytics-System/actions/workflows/tests.yml/badge.svg)](https://github.com/Jayendra70/NYC-Taxi-Fare-Forecasting-Analytics-System/actions/workflows/tests.yml)
![Python](https://img.shields.io/badge/Python-3.11+-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi&logoColor=white)
![XGBoost](https://img.shields.io/badge/XGBoost-3.2-orange?logo=xgboost)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![Express](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)
![Google Maps](https://img.shields.io/badge/Google_Routes_API-4285F4?logo=googlemaps&logoColor=white)
![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)

---

## 📈 Results

**Current model** (`notebooks/02_full_year_model_training.ipynb`): 3,949,995 trips, split chronologically into 3,159,996 for training and the latest 789,999 for testing.

| Metric (789,999-trip chronological holdout) | Value |
|---|---|
| MAE | $1.04 |
| RMSE | $3.27 |
| MAPE | 5.72% |
| R² | 0.961 |

**Against simple baselines** (`notebooks/03_baselines_and_input_error.ipynb`, January 2024, last 20% of the month as the test set). Metered fares are mostly distance and time, so even a linear model reaches R² 0.92; the error reduction is the number that matters.

| Method | MAE | MAPE |
|---|---|---|
| Linear regression (miles, seconds, airport flag) | $2.46 | 17.8% |
| Meter formula: 3 + 0.70 × max(5 × miles, minutes) | $2.63 | 14.3% |
| **XGBoost (notebook 02 recipe)** | **$0.76** | **4.5%** |

XGBoost cuts MAE by 69% against the linear baseline on that month.

**Two known limits of the current model, and the fix.**

- **It saw 38 days, not 12 months.** `dim_clima.csv` holds weather for only the first 3–4 days of each month, and notebook 02 drops trips without weather. So the 3.95M training trips come from 38 days of the ~40M trips in 2024.
- **It is scored on recorded inputs.** Training and evaluation use each trip's *recorded* distance and duration, but a live request only has *estimates*. On January data, ±15% error in time and ±10% in distance raises MAE from $0.76 to $1.06.

`notebooks/04_full_year_weather_retrain.ipynb` fixes both. It joins hourly 2024 weather from Open-Meteo's archive (the same source the gateway uses live), so no trips are dropped. It switches to out-of-fold route encoding and a time-ordered tuning sample, and it reports the holdout with request-time estimates next to recorded inputs. It needs internet and a few GB of RAM, so run it locally; it exports the model and `route_means.json` for the API.

---

## 📐 System Architecture

The application follows a **three-tier microservice architecture**: a React frontend talks to a Node.js API gateway, which enriches each request with live traffic and weather data before forwarding it to a Python ML inference service.

```
┌─────────────────────────────────────────────────────────────┐
│                    BROWSER (React + Vite)                    │
│                                                             │
│  ┌─────────┐   ┌──────────┐   ┌──────────────────────────┐ │
│  │ Map UI  │──▶│ Zone     │──▶│ Payload Builder          │ │
│  │ (Pigeon)│   │ Resolver │   │ (coords + weather + time)│ │
│  └─────────┘   └──────────┘   └────────────┬─────────────┘ │
└─────────────────────────────────────────────┼───────────────┘
                                              │ POST /predict
                                              ▼
┌─────────────────────────────────────────────────────────────┐
│              API GATEWAY (Express.js · Port 5001)           │
│                                                             │
│  1. Validate input coordinates                              │
│  2. Geo-fence check (Turf.js point-in-polygon)              │
│  3. Call Google Routes API (live traffic + toll calc)       │
│  4. Override trip_miles & trip_time with route estimates    │
│  5. Fetch current NYC weather from Open-Meteo (°C)          │
│  6. Fall back to Haversine math if Google is unavailable    │
│  7. Proxy the enriched payload to the Python ML service     │
└──────────────────────────┬──────────────────────────────────┘
                           │ POST /predict
                           ▼
┌─────────────────────────────────────────────────────────────┐
│          ML INFERENCE SERVICE (FastAPI · Port 8000)          │
│                                                             │
│  1. Validate with Pydantic schema                           │
│  2. Engineer features (borough OHE, speed, route encoding)  │
│  3. Look up the historical route fare (Bayesian-smoothed)   │
│  4. Run XGBoost (feature order read from the model itself)  │
│  5. Apply TLC surcharge business rules                      │
│  6. Return an itemized fare breakdown                       │
└─────────────────────────────────────────────────────────────┘
```

---

## 🧠 ML Model Summary

| Attribute | Details |
|---|---|
| **Algorithm** | XGBoost Regressor |
| **Training data** | NYC TLC 2024 yellow-taxi trips: 3,949,995 trips from the 38 days with weather (notebook 02); notebook 04 retrains on the full year |
| **Features** | 25 in notebook 02: distance, time, implied speed, hour, weekend, airport flag, weather, borough one-hot, route encoding |
| **Target** | `fare_amount` (metered base fare in USD) |
| **Hyperparameters** | Tuned with RandomizedSearchCV: 300 trees, learning_rate 0.05, max_depth 6, subsample 0.9, colsample_bytree 0.8 |
| **Validation** | Chronological 80/20 split; MAE, RMSE, MAPE, R² |

### Key Feature Engineering

- **`implied_speed_mph`**: `(trip_miles / trip_time) × 3600`, clamped to [0, 75]; captures traffic conditions
- **`historical_route_fare`**: Bayesian-smoothed mean fare for each pickup→drop-off route (m = 50), fit on the training split only; routes with no history use the meter-formula fallback
- **Borough one-hot encoding**: 12 binary columns (6 boroughs × pickup/drop-off)
- **`is_airport_trip`**: JFK (zone 132), LaGuardia (zone 138), Newark (zone 1)
- **Weather**: temperature, precipitation and snowfall. Training uses `dim_clima` daily values (notebook 02) or hourly Open-Meteo archive data (notebook 04); serving uses current Open-Meteo conditions

### TLC Business Rules (Post-Prediction Surcharges)

| Rule | Amount |
|---|---|
| Manhattan ↔ JFK flat rate | $70.00 (overrides ML prediction) |
| Rush hour surcharge (4–8 PM weekdays) | $2.50 / $5.00 for Manhattan ↔ JFK |
| Overnight surcharge (8 PM – 6 AM) | $1.00 |
| LaGuardia airport surcharge | $5.00 |
| Newark airport surcharge | $20.00 |
| Airport improvement fee (JFK/LGA pickups) | $2.00 |
| MTA & improvement surcharge | $1.50 |
| Manhattan congestion + improvement | $3.25 |

These rules are covered by unit tests in `service/ml-inference/tests/test_surcharges.py`.

---

## 🗂 Data Pipeline

The dimension tables follow a **star schema** around the TLC trip records:

```
                    ┌───────────────────┐
                    │  dim_localizacao  │
                    │  (263 TLC zones)  │
                    └────────┬──────────┘
                             │
┌────────────────┐   ┌──────┴──────┐   ┌───────────────┐
│   dim_clima    │───│  trips      │───│   dim_data    │
│ (38 daily rows)│   │ (TLC files) │   │ (366 dates)   │
└────────────────┘   └─────────────┘   └───────────────┘
```

> **Note**: Column names in the dimension CSVs are in Portuguese (e.g., `localizacao_id`, `bairro`, `precipitacao`) and are translated to English in the pipeline. `dim_clima` covers only the first 3–4 days of each month, which is why notebook 04 replaces it with hourly Open-Meteo data.

---

## 🚀 Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- (Optional) Google Routes API key — [Get one here](https://console.cloud.google.com/apis/credentials)

### 1. Clone & set up

```bash
git clone https://github.com/Jayendra70/NYC-Taxi-Fare-Forecasting-Analytics-System.git
cd NYC-Taxi-Fare-Forecasting-Analytics-System
```

### 2. Get the model

The trained model (`production_taxi_master_model_2024.joblib`) is too large for git. Produce it by running `notebooks/04_full_year_weather_retrain.ipynb` (or `02_full_year_model_training.ipynb`); either one writes it, with `route_means.json`, into `service/ml-inference/`. The service reads the feature order from the model, so either notebook's model works.

### 3. Start the ML inference service

```bash
cd service/ml-inference
python -m venv venv
source venv/bin/activate       # Windows: venv\Scripts\activate
pip install -r requirements-dev.txt
pytest                         # 15 tests; they use a small stand-in model, no download needed
uvicorn main:app --reload --port 8000
```

### 4. Start the API gateway

```bash
cd service/api-gateway
cp .env.example .env           # Add your Google Routes API key (optional)
npm install
npm start
```

### 5. Start the frontend

```bash
cd service/web-frontend
cp .env.example .env
npm install
npm run dev
```

Open **http://localhost:5173** in your browser.

### 6. The notebooks

| Notebook | What it does |
|---|---|
| `01_eda_and_evaluation.ipynb` | EDA plots on a sample of each month |
| `02_full_year_model_training.ipynb` | The current model: tuning, training, holdout metrics, export |
| `03_baselines_and_input_error.ipynb` | Baselines and input-error sensitivity on January 2024 |
| `04_full_year_weather_retrain.ipynb` | Full-year retrain with hourly weather, out-of-fold encoding, baselines and request-time evaluation |

```bash
python -m venv .venv && source .venv/bin/activate
pip install pandas numpy xgboost scikit-learn pyarrow matplotlib seaborn joblib
```

Select the `.venv` kernel in your notebook editor, then run top to bottom. The notebooks download the TLC files they need into `service/ml-inference/data/`.

---

## 🔑 Environment Variables

### API Gateway (`service/api-gateway/.env`)
| Variable | Required | Description |
|---|---|---|
| `PORT` | No | Gateway port (default: `5001`) |
| `PYTHON_MICROSERVICE_URL` | No | ML service URL (default: `http://127.0.0.1:8000`) |
| `GOOGLE_MAPS_API_KEY` | No | Enables live traffic enrichment via Google Routes API |

### ML inference service
| Variable | Required | Description |
|---|---|---|
| `TAXI_MODEL_PATH` | No | Model file (default: `service/ml-inference/production_taxi_master_model_2024.joblib`) |

### Frontend (`service/web-frontend/.env`)
| Variable | Required | Description |
|---|---|---|
| `VITE_API_URL` | No | API Gateway URL (default: `http://localhost:5001`) |

---

## 📁 Project Structure

```
NYC-Taxi-Fare-Forecasting-Analytics-System/
├── README.md, CONTRIBUTING.md, LICENSE, .editorconfig, .gitignore
├── .github/workflows/tests.yml   # CI: runs the inference-service tests
├── notebooks/                    # 01 EDA · 02 current model · 03 baselines · 04 full-year retrain
│   └── plots/                    # EDA and evaluation charts
└── service/
    ├── ml-inference/             # 🐍 FastAPI ML service
    │   ├── main.py               # Inference API + TLC business rules
    │   ├── features.py           # Notebook 02's feature list
    │   ├── conftest.py, tests/   # 15 pytest tests (stand-in model)
    │   ├── requirements.txt      # Pinned to the training environment
    │   ├── requirements-dev.txt  # + pytest, httpx
    │   ├── route_means.json      # Bayesian-smoothed route fare lookup
    │   └── data/                 # dim_localizacao (263 zones), dim_clima (38 days), dim_data (366 days)
    │                             # TLC parquet files and the model are downloaded/generated, not in git
    ├── api-gateway/              # 🟢 Node.js Express gateway (server.js, zone GeoJSON)
    └── web-frontend/             # ⚛️ React + Vite map UI
```

---

## 🛠 Engineering Challenges Solved

<details>
<summary><strong>1. Google API Authorization Constraints</strong></summary>

**Issue**: Requests to the Google Routes API returned `403 Forbidden` despite a valid key.

**Resolution**: The API key was historically restricted to the legacy Distance Matrix API. Permissions were updated in the GCP console to explicitly authorize the Routes API endpoint.
</details>

<details>
<summary><strong>2. Routes API v2 Schema Rejection</strong></summary>

**Issue**: Payload returned `400 Bad Request: Unknown name "computeTolls"`.

**Resolution**: Google silently updated their v2 schema. Migrated the boolean flag to the required array format: `extraComputations: ["TOLLS"]`.
</details>

<details>
<summary><strong>3. The $3.00 Prediction Floor (Log-Transform Reversal)</strong></summary>

**Issue**: XGBoost consistently outputted ~$2.57, triggering the $3.00 legal minimum fare fallback for medium-to-long trips.

**Resolution**: The model was trained on a log-transformed target. Implemented `np.expm1()` (`Base Fare = e^raw_prediction − 1`) to correctly scale predictions back to USD.

*This was an earlier model version. The current notebooks train on `fare_amount` directly, so the service applies no inverse transform.*
</details>

<details>
<summary><strong>4. Target Encoding Poisoning (The $2.57 Glitch)</strong></summary>

**Issue**: Unpopular routes caused the model to drastically under-predict fares due to corrupted, sparse historical data.

**Resolution**: Implemented **Bayesian Smoothing** during training to regularize rare route averages toward the global mean. In production, engineered a **Synthetic Meter** fallback that calculates a deterministic time-and-distance fare for routes lacking sufficient historical data.
</details>

<details>
<summary><strong>5. API Gateway Timeout Failures</strong></summary>

**Issue**: Complex route calculations threw `timeout of 5000ms exceeded` from the Routes API.

**Resolution**: Increased external API round-trip timeout to 10,000ms to accommodate latency during peak traffic-graph calculations.
</details>

<details>
<summary><strong>6. Notebook and API Feature Drift</strong></summary>

**Issue**: The API hardcoded 27 input columns, including the raw zone IDs, while the final training notebook used 25. XGBoost rejected every request with `feature_names mismatch`.

**Resolution**: The service now reads the feature order from the trained model (`feature_names_in_`) and fails loudly if it cannot build a feature. A `/predict` test against a stand-in model guards it.
</details>

<details>
<summary><strong>7. A Weather Join That Dropped 90% of the Year</strong></summary>

**Issue**: The weather table covered 38 dates, and trips without weather were dropped, so the "full-year" model trained on 38 days.

**Resolution**: Notebook 04 joins hourly Open-Meteo archive weather on the pickup hour, covering every trip, with the same variables and units as the live gateway call.
</details>

<details>
<summary><strong>8. A Meter Fallback That Double-Charged Slow Trips</strong></summary>

**Issue**: The rare-route fallback added a full time charge on top of the full distance charge whenever speed fell below 12 mph. The real meter charges one or the other. On January trips it missed by $5.18 on average.

**Resolution**: `3 + 0.70 × max(5 × miles, minutes)`, which misses by $2.63 (notebook 03).
</details>

---

## 📊 Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **ML Model** | XGBoost, scikit-learn, pandas, NumPy | Regression model training and inference |
| **ML API** | FastAPI, Pydantic, Uvicorn, pytest | Model serving with request validation and tests |
| **API Gateway** | Express.js, Axios, Turf.js | Traffic enrichment, geo-fencing, request proxy |
| **Frontend** | React 19, Vite 8, Pigeon Maps | Interactive map UI with dark theme |
| **Data** | NYC TLC 2024 trip records | Yellow-taxi trips plus zone, date and weather dimensions |
| **Traffic Enrichment** | Google Routes API v2 | Traffic-aware distance, duration and toll estimates |
| **Weather Enrichment** | Open-Meteo API | Live and historical NYC temperature, precipitation and snowfall |

---

## 🔮 Future Improvements

- [ ] Run notebook 04 on the full year and replace the results above with its holdout numbers
- [ ] Evaluate with real Google Routes estimates on a sample of test trips, not only route medians
- [ ] Request rate limiting on the API gateway
- [ ] Trip history panel to compare multiple fare estimates
- [ ] Mapbox GL for higher-quality map tiles

---

## 🤝 Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## 📜 License

This project is licensed under the [MIT License](LICENSE).

NYC TLC data is publicly available at [tlc.nyc.gov](https://www.nyc.gov/site/tlc/about/tlc-trip-record-data.page).
