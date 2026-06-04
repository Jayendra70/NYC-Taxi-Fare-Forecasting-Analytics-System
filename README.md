# 🚕 NYC Taxi Fare Predictor

**ML-powered fare estimation using XGBoost, live traffic enrichment, and real-time weather data.**

An end-to-end data science project built on NYC TLC (Taxi & Limousine Commission) 2024 trip records. Users click pickup and drop-off locations on an interactive map, and the system predicts the total fare by combining an XGBoost regression model with official TLC surcharge business rules.

![Python](https://img.shields.io/badge/Python-3.11+-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi&logoColor=white)
![XGBoost](https://img.shields.io/badge/XGBoost-2.1-orange?logo=xgboost)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![Express](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)

---

## 📐 Architecture

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
│  1. Validate input                                          │
│  2. Call Google Maps Distance Matrix API (live traffic)     │
│  3. Override trip_miles & trip_time with real data           │
│  4. Fallback to Haversine math if Google unavailable        │
│  5. Proxy enriched payload to Python ML service             │
└──────────────────────────┬──────────────────────────────────┘
                           │ POST /predict
                           ▼
┌─────────────────────────────────────────────────────────────┐
│          ML INFERENCE SERVICE (FastAPI · Port 8000)          │
│                                                             │
│  1. Validate with Pydantic schema                           │
│  2. Engineer features (route_id, borough IDs)               │
│  3. Run XGBoost prediction (11 features)                    │
│  4. Apply TLC surcharge business rules                      │
│  5. Return fare breakdown                                   │
└─────────────────────────────────────────────────────────────┘
```

---

## 🧠 ML Model Summary

| Attribute | Details |
|---|---|
| **Algorithm** | XGBoost Regressor |
| **Training Data** | NYC TLC 2024 trip records (~960 MB, star schema) |
| **Features** | 11 engineered features (zone IDs, distance, borough, route, weather, weekend/airport flags) |
| **Target** | `fare_amount` (total fare in USD) |
| **Hyperparameters** | 300 trees, lr=0.05, max_depth=8, subsample=0.8, colsample_bytree=0.8 |
| **Evaluation Metric** | Mean Absolute Error (MAE) |

### Feature Engineering
- **route_id**: Encodes the pickup→dropoff route as a unique integer (`PU * 1000 + DO`)
- **Borough IDs**: Maps 263 TLC zones to 6 borough categories
- **Airport flag**: Binary indicator for JFK, LaGuardia, Newark trips
- **Weekend flag**: Derived from day-of-week in the time dimension table
- **Weather features**: Temperature (avg of max/min), precipitation, snowfall

### TLC Business Rules Applied Post-Prediction
- Manhattan ↔ JFK flat rate: $70.00
- Rush hour surcharge (4–7 PM weekdays): $2.50 / $5.00 for airport
- Overnight surcharge (8 PM – 6 AM): $1.00
- LaGuardia surcharge: $5.00
- Newark surcharge: $20.00
- Airport improvement fee: $2.00
- Manhattan congestion + improvement: $3.25

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

> **Note**: Column names in the source CSVs are in Portuguese (e.g., `localizacao_id`, `bairro`, `precipitacao`) and are translated to English during the ETL pipeline.

---

## 🚀 Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- (Optional) Google Maps Distance Matrix API key

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
cp .env.example .env           # Add your Google Maps API key (optional)
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

---

## 🔑 Environment Variables

### API Gateway (`service/api-gateway/.env`)
| Variable | Required | Description |
|---|---|---|
| `PORT` | No | Gateway port (default: 5001) |
| `PYTHON_MICROSERVICE_URL` | No | ML service URL (default: http://127.0.0.1:8000) |
| `GOOGLE_MAPS_API_KEY` | No | Enables live traffic enrichment |

### Frontend (`service/web-frontend/.env`)
| Variable | Required | Description |
|---|---|---|
| `VITE_API_URL` | No | API Gateway URL (default: http://localhost:5001) |

---

## 📁 Project Structure

```
nyc-taxi-predictor/
├── .gitignore
├── README.md
├── service/
│   ├── ml-inference/              # Python FastAPI ML Service
│   │   ├── main.py                # Inference API with TLC business rules
│   │   ├── train_2024_model.py    # Model training script
│   │   ├── requirements.txt       # Python dependencies
│   │   ├── production_taxi_model_2024.joblib
│   │   └── data/
│   │       ├── fact_trips_final.csv    # ~960 MB (not in git)
│   │       ├── dim_localizacao.csv     # 263 TLC zones
│   │       ├── dim_clima.csv           # Weather data
│   │       └── dim_data.csv            # Calendar dimension
│   ├── api-gateway/               # Node.js Express Gateway
│   │   ├── server.js              # Google Maps enrichment + proxy
│   │   ├── package.json
│   │   ├── .env.example
│   │   └── nyc_taxi_zones.geojson # GeoJSON for zone boundaries
│   └── web-frontend/             # React + Vite Frontend
│       ├── src/
│       │   ├── App.jsx            # Main component (263 zone centroids)
│       │   ├── App.css            # Dark theme + glassmorphism
│       │   ├── index.css          # Global reset
│       │   └── main.jsx           # Entry point
│       ├── index.html
│       ├── package.json
│       └── .env.example
```

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

## 📊 Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **ML Model** | XGBoost, scikit-learn, pandas | Regression model training and evaluation |
| **ML API** | FastAPI, Pydantic, Uvicorn | Model serving with validation |
| **API Gateway** | Express.js, Axios | Google Maps enrichment, request proxy |
| **Frontend** | React 19, Vite 8, Pigeon Maps | Interactive map UI |
| **Data** | NYC TLC 2024, Open-Meteo API | Trip records, live weather |
| **Enrichment** | Google Maps Distance Matrix API | Real-time traffic-aware routing |

---

## 📜 License

This project is for educational purposes. NYC TLC data is publicly available at [tlc.nyc.gov](https://www.nyc.gov/site/tlc/about/tlc-trip-record-data.page).
