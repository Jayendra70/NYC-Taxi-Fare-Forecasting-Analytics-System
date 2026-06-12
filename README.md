# 🚕 NYC Taxi Fare Predictor

**ML-powered fare estimation using XGBoost, live Google Routes traffic data, and real-time NYC weather.**

An end-to-end data science project built on NYC TLC (Taxi & Limousine Commission) 2024 trip records. Users click pickup and drop-off locations on an interactive map, and the system predicts the total fare by combining an XGBoost regression model with live traffic enrichment from Google Routes API and official TLC surcharge business rules.

![Python](https://img.shields.io/badge/Python-3.11+-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi&logoColor=white)
![XGBoost](https://img.shields.io/badge/XGBoost-2.1-orange?logo=xgboost)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![Express](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)
![Google Maps](https://img.shields.io/badge/Google_Routes_API-4285F4?logo=googlemaps&logoColor=white)
![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)

---

## 📐 System Architecture

The application follows a **three-tier microservice architecture**: a React frontend communicates with a Node.js API Gateway, which enriches requests with live traffic and weather data before forwarding to a Python ML inference service.

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
│  3. Call Google Routes API (live traffic + toll calc)        │
│  4. Override trip_miles & trip_time with real data           │
│  5. Fetch live NYC weather from Open-Meteo API              │
│  6. Fallback to Haversine math if Google unavailable        │
│  7. Proxy enriched payload to Python ML service             │
└──────────────────────────┬──────────────────────────────────┘
                           │ POST /predict
                           ▼
┌─────────────────────────────────────────────────────────────┐
│          ML INFERENCE SERVICE (FastAPI · Port 8000)          │
│                                                             │
│  1. Validate with Pydantic schema                           │
│  2. Engineer features (borough OHE, speed, route encoding)  │
│  3. Lookup historical route fare (Bayesian-smoothed)        │
│  4. Run XGBoost prediction (27 features)                    │
│  5. Apply TLC surcharge business rules                      │
│  6. Return itemized fare breakdown                          │
└─────────────────────────────────────────────────────────────┘
```

> **Full architecture deep-dive**: See [`docs/PROJECT_DOCUMENTATION.md`](docs/PROJECT_DOCUMENTATION.md)

---

## 🧠 ML Model Summary

| Attribute | Details |
|---|---|
| **Algorithm** | XGBoost Regressor |
| **Training Data** | NYC TLC 2024 yellow taxi trip records (~960 MB, star schema) |
| **Features** | 27 engineered features (zone IDs, distance, time, speed, borough OHE, weather, route encoding) |
| **Target** | `fare_amount` (base fare in USD) |
| **Hyperparameters** | 300 trees, learning_rate=0.05, max_depth=8, subsample=0.8, colsample_bytree=0.8 |
| **Evaluation Metric** | Mean Absolute Error (MAE) |

### Key Feature Engineering

- **`implied_speed_mph`**: Computed as `(trip_miles / trip_time) × 3600`, clamped to [0, 75] — captures traffic conditions
- **`historical_route_fare`**: Bayesian-smoothed mean fare for each pickup→dropoff route pair (with synthetic meter fallback for rare routes)
- **Borough One-Hot Encoding**: 12 binary columns (6 boroughs × pickup/dropoff)
- **`is_airport_trip`**: Binary flag for JFK (Zone 132), LaGuardia (Zone 138), Newark (Zone 1)
- **Weather features**: Real-time temperature, precipitation, and snowfall from Open-Meteo

### TLC Business Rules (Post-Prediction Surcharges)

| Rule | Amount |
|---|---|
| Manhattan ↔ JFK flat rate | $70.00 (overrides ML prediction) |
| Rush hour surcharge (4–7 PM weekdays) | $2.50 / $5.00 for airport |
| Overnight surcharge (8 PM – 6 AM) | $1.00 |
| LaGuardia airport surcharge | $5.00 |
| Newark airport surcharge | $20.00 |
| Airport improvement fee | $2.00 |
| MTA & improvement surcharge | $1.50 |
| Manhattan congestion + improvement | $3.25 |

---

## 🗂 Data Pipeline

The training data follows a **star schema** design sourced from the NYC TLC:

```
                    ┌───────────────────┐
                    │  dim_localizacao   │
                    │  (263 TLC zones)   │
                    └────────┬──────────┘
                             │
┌────────────────┐   ┌──────┴──────┐   ┌───────────────┐
│   dim_clima    │───│ fact_trips  │───│   dim_data    │
│  (38 weather   │   │  (960 MB)   │   │ (366 dates)   │
│   records)     │   └─────────────┘   └───────────────┘
└────────────────┘
```

> **Note**: Column names in the source CSVs are in Portuguese (e.g., `localizacao_id`, `bairro`, `precipitacao`) and are translated to English during the inference pipeline.

---

## 🚀 Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- (Optional) Google Routes API key — [Get one here](https://console.cloud.google.com/apis/credentials)

### 1. Clone & Setup

```bash
git clone https://github.com/YOUR_USERNAME/nyc-taxi-predictor.git
cd nyc-taxi-predictor
```

### 2. Start the ML Inference Service

```bash
cd service/ml-inference
python -m venv venv
source venv/bin/activate       # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 3. Start the API Gateway

```bash
cd service/api-gateway
cp .env.example .env           # Add your Google Routes API key (optional)
npm install
npm start
```

### 4. Start the Frontend

```bash
cd service/web-frontend
cp .env.example .env
npm install
npm run dev
```

Open **http://localhost:5173** in your browser.



### 5. Running the Data Science Notebooks

If you want to view the data charts or retrain the master XGBoost model on the full 40-million row dataset:

1. Open `notebooks/02_full_year_model_training.ipynb` in **VS Code** or **JupyterLab**.
2. Make sure you install the required dependencies into your root environment:
   ```bash
   python -m venv .venv
   source .venv/bin/activate
   pip install pandas numpy xgboost scikit-learn pyarrow matplotlib seaborn joblib
   ```
3. **CRITICAL**: In the top right corner of your notebook editor, click the **Kernel / Python Environment** selector. You must select the `.venv` kernel you just created. If you use the system Python kernel, you will encounter `ModuleNotFoundError`s.
4. Run the notebook from top to bottom. It will automatically download the NYC Parquet files into `service/ml-inference/data/` and optimize memory automatically.
---

## 🔑 Environment Variables

### API Gateway (`service/api-gateway/.env`)
| Variable | Required | Description |
|---|---|---|
| `PORT` | No | Gateway port (default: `5001`) |
| `PYTHON_MICROSERVICE_URL` | No | ML service URL (default: `http://127.0.0.1:8000`) |
| `GOOGLE_MAPS_API_KEY` | No | Enables live traffic enrichment via Google Routes API |

### Frontend (`service/web-frontend/.env`)
| Variable | Required | Description |
|---|---|---|
| `VITE_API_URL` | No | API Gateway URL (default: `http://localhost:5001`) |

---

## 📁 Project Structure

```
nyc-taxi-predictor/
├── .editorconfig                 # Coding style consistency
├── .gitignore                    # Git ignore rules
├── CONTRIBUTING.md               # Contribution guidelines
├── LICENSE                       # MIT License
├── README.md                     # This file
│
├── docs/
│   ├── PROJECT_DOCUMENTATION.md  # Full project docs & architecture
│   └── CODE_EXPLANATION.md       # Line-by-line code walkthrough
│
├── notebooks/                    # 📓 Data Science & Training
│   ├── 01_eda_and_evaluation.ipynb      # Subsampled data exploration & charts
│   └── 02_full_year_model_training.ipynb # 12-month automated training pipeline
│
└── service/
    ├── ml-inference/             # 🐍 Python FastAPI ML Service
    │   ├── main.py               # Inference API with TLC business rules
    │   ├── requirements.txt      # Python dependencies
    │   ├── .env.example          # Environment template
    │   ├── production_taxi_master_model_2024.joblib  # Trained XGBoost model
    │   ├── route_means.json      # Bayesian-smoothed route fare lookup
    │   └── data/
    │       ├── dim_localizacao.csv  # 263 TLC zone definitions
    │       ├── dim_clima.csv       # Monthly weather aggregates
    │       ├── dim_data.csv        # Calendar dimension (366 days)
    │       └── fact_trips_final.csv # ~960 MB trip records (not in git)
    │
    ├── api-gateway/              # 🟢 Node.js Express Gateway
    │   ├── server.js             # Google Routes enrichment + proxy
    │   ├── package.json          # Node dependencies
    │   ├── .env.example          # Environment template
    │   ├── .gitignore            # Local ignore rules
    │   └── nyc_taxi_zones.geojson  # GeoJSON for zone boundary checks
    │
    └── web-frontend/            # ⚛️ React + Vite Frontend
        ├── src/
        │   ├── App.jsx           # Main component (map, zones, fare display)
        │   ├── App.css           # Dark theme + glassmorphism styling
        │   ├── index.css         # Global reset
        │   └── main.jsx          # React entry point
        ├── public/
        │   ├── favicon.svg       # Custom taxi favicon
        │   └── icons.svg         # UI icon sprites
        ├── index.html            # HTML entry with SEO meta tags
        ├── package.json          # React/Vite dependencies
        ├── vite.config.js        # Vite bundler configuration
        ├── eslint.config.js      # ESLint flat config
        ├── .env.example          # Environment template
        └── .gitignore            # Local ignore rules
```

---

## 🛠 Engineering Challenges Solved

Building a deterministic bridge between Google Maps traffic forecasting and historical TLC behavior required clearing several complex technical hurdles:

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

---

## 📊 Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **ML Model** | XGBoost, scikit-learn, pandas, NumPy | Regression model training and inference |
| **ML API** | FastAPI, Pydantic, Uvicorn | Model serving with request validation |
| **API Gateway** | Express.js, Axios, Turf.js | Traffic enrichment, geo-fencing, request proxy |
| **Frontend** | React 19, Vite 8, Pigeon Maps | Interactive map UI with dark theme |
| **Data** | NYC TLC 2024 Records | ~960 MB star schema trip data |
| **Traffic Enrichment** | Google Routes API v2 | Real-time traffic-aware distance, duration, and toll calculation |
| **Weather Enrichment** | Open-Meteo API | Live NYC temperature, precipitation, and snowfall |

---

## 🔮 Future Improvements

- [ ] Add Jupyter notebook for EDA and model evaluation (feature importance, residual plots, learning curves)
- [ ] Implement cross-validation (5-fold CV) and report R², RMSE, MAPE alongside MAE
- [ ] Add Dockerfiles and `docker-compose.yml` for one-command deployment
- [ ] Implement request rate limiting on the API Gateway
- [ ] Add unit tests for the surcharge calculation logic
- [ ] Add trip history panel to compare multiple fare estimates
- [ ] Integrate with Mapbox GL for higher-quality map tiles

---

## 🤝 Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## 📜 License

This project is licensed under the [MIT License](LICENSE).

NYC TLC data is publicly available at [tlc.nyc.gov](https://www.nyc.gov/site/tlc/about/tlc-trip-record-data.page).
