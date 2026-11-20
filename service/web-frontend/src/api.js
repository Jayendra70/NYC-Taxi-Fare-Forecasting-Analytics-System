const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

async function request(path, options) {
  const response = await fetch(`${API_URL}${path}`, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`);
  return body;
}

export function lookupZone(lat, lng) {
  return request(`/zone?lat=${lat}&lng=${lng}`);
}

export function predictFare(pickup, dropoff) {
  return request('/predict', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ puLat: pickup.lat, puLng: pickup.lng, doLat: dropoff.lat, doLng: dropoff.lng }),
  });
}

// Free hosting puts idle services to sleep, so the first request after a
// quiet period can take most of a minute. Poll /health until it answers.
export async function waitForServer({ attempts = 18, delayMs = 5000, isCancelled = () => false } = {}) {
  for (let i = 0; i < attempts && !isCancelled(); i++) {
    try {
      const response = await fetch(`${API_URL}/health`);
      if (response.ok) return true;
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return false;
}
