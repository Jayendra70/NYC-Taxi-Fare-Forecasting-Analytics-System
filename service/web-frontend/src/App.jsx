import { useEffect, useState } from 'react';
import { lookupZone, predictFare, waitForServer } from './api';
import FareCard from './components/FareCard';
import MapPicker from './components/MapPicker';
import TripCard from './components/TripCard';
import './App.css';

const samePoint = (a, b) => a && b && a.lat === b.lat && a.lng === b.lng;

export default function App() {
  const [pickup, setPickup] = useState(null);
  const [dropoff, setDropoff] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [server, setServer] = useState('checking');

  useEffect(() => {
    let cancelled = false;
    const slow = setTimeout(() => setServer((s) => (s === 'checking' ? 'waking' : s)), 2000);
    waitForServer({ isCancelled: () => cancelled }).then((up) => {
      clearTimeout(slow);
      if (!cancelled) setServer(up ? 'ready' : 'down');
    });
    return () => {
      cancelled = true;
      clearTimeout(slow);
    };
  }, []);

  // First click sets the pickup, second the drop-off, a third starts over.
  async function handlePick([lat, lng]) {
    const point = { lat, lng, zone: null };
    const settingPickup = !pickup || dropoff;
    const setPoint = settingPickup ? setPickup : setDropoff;

    setResult(null);
    setError(null);
    if (settingPickup) setDropoff(null);
    setPoint(point);

    try {
      const zone = await lookupZone(lat, lng);
      setPoint((current) => (samePoint(current, point) ? { ...point, zone } : current));
    } catch (err) {
      setPoint((current) => (samePoint(current, point) ? null : current));
      setError(err.message);
    }
  }

  async function handlePredict() {
    setLoading(true);
    setError(null);
    try {
      setResult(await predictFare(pickup, dropoff));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setPickup(null);
    setDropoff(null);
    setResult(null);
    setError(null);
  }

  const ready = Boolean(pickup?.zone && dropoff?.zone);
  let hint = 'Click the map to set your pickup.';
  if (pickup && !dropoff) hint = 'Now click your drop-off.';
  if (pickup && dropoff) hint = 'Get a fare, or click the map to start a new trip.';

  return (
    <div className="app">
      <header className="header">
        <img src="/favicon.svg" alt="" className="logo" />
        <h1>NYC Taxi Fare Predictor</h1>
        <p>XGBoost trained on 2024 TLC yellow-taxi trips, with live traffic and weather.</p>
      </header>

      <main className="main">
        {server === 'waking' && (
          <p className="notice">Waking the server up. Free hosting sleeps when idle, so this can take up to a minute.</p>
        )}
        {server === 'down' && <p className="notice error">The prediction service is not responding right now.</p>}

        <p className="hint">{hint}</p>
        <MapPicker pickup={pickup} dropoff={dropoff} onPick={handlePick} />
        <TripCard pickup={pickup} dropoff={dropoff} />

        <div className="actions">
          <button className="primary" onClick={handlePredict} disabled={!ready || loading}>
            {loading ? (
              <>
                <span className="spinner" /> Getting route…
              </>
            ) : (
              'Get fare estimate'
            )}
          </button>
          {(pickup || dropoff) && (
            <button className="secondary" onClick={handleReset}>
              Reset
            </button>
          )}
        </div>

        {error && <p className="notice error">{error}</p>}
        {result && <FareCard result={result} />}
      </main>

      <footer className="footer">
        Model trained on NYC TLC 2024 trip records · Weather from Open-Meteo · Map tiles © OpenStreetMap
      </footer>
    </div>
  );
}
