const axios = require('axios');

const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast?latitude=40.7128&longitude=-74.0060' +
  '&current=temperature_2m,precipitation,snowfall&timezone=America%2FNew_York';
const CACHE_MS = 10 * 60 * 1000;
// Used when Open-Meteo is unreachable: NYC's annual mean temperature, dry.
// The model was trained on Celsius.
const FALLBACK_WEATHER = { temp: 13.0, precip: 0, snow: 0, source: 'fallback' };

let cached = null;

async function getWeather(now = Date.now()) {
  if (cached && now - cached.fetchedAt < CACHE_MS) return cached.weather;
  try {
    const { data } = await axios.get(WEATHER_URL, { timeout: 3000 });
    const weather = {
      temp: data.current.temperature_2m,
      precip: data.current.precipitation,
      snow: data.current.snowfall,
      source: 'open-meteo',
    };
    cached = { weather, fetchedAt: now };
    return weather;
  } catch (error) {
    console.warn('Open-Meteo request failed, using fallback weather:', error.message);
    return FALLBACK_WEATHER;
  }
}

function clearWeatherCache() {
  cached = null;
}

function nycClock(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    hourCycle: 'h23',
    weekday: 'short',
  }).formatToParts(date);
  const part = (type) => parts.find((p) => p.type === type).value;
  return { hour: Number(part('hour')), isWeekend: ['Sat', 'Sun'].includes(part('weekday')) };
}

module.exports = { getWeather, clearWeatherCache, nycClock };
