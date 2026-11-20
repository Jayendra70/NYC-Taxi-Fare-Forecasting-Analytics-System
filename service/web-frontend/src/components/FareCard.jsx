const TIP_RATE = 0.2;
const money = (value) => `$${value.toFixed(2)}`;

function formatHour(hour) {
  const suffix = hour < 12 ? 'AM' : 'PM';
  return `${hour % 12 || 12} ${suffix}`;
}

function Line({ label, value, className = '' }) {
  return (
    <div className={`line ${className}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

export default function FareCard({ result }) {
  const { breakdown, predicted_fare: meterFare, tolls, trip, conditions } = result;
  const { surcharges } = breakdown;
  const total = meterFare + tolls;
  const tip = meterFare * TIP_RATE;
  const fahrenheit = (conditions.temp_c * 9) / 5 + 32;
  const routeSource = trip.route_source === 'google' ? 'Google traffic route' : 'straight-line estimate';

  return (
    <section className="fare-card">
      <div className="fare-header">
        <span className="fare-label">Estimated fare</span>
        <span className="fare-total">{money(total)}</span>
      </div>
      <p className="fare-route">
        {trip.pickup.name} → {trip.dropoff.name}
      </p>

      <div className="lines">
        <Line label="Metered fare (model)" value={money(breakdown.base_prediction)} />
        <Line label="MTA tax + improvement surcharge" value={money(surcharges.mta_and_improvement)} />
        {surcharges.time_surcharges > 0 && <Line label="Rush hour / overnight" value={money(surcharges.time_surcharges)} />}
        {surcharges.congestion_tolls > 0 && <Line label="Congestion surcharges" value={money(surcharges.congestion_tolls)} />}
        {surcharges.airport_fees > 0 && <Line label="Airport fees" value={money(surcharges.airport_fees)} />}
        {tolls > 0 && <Line label="Bridge and tunnel tolls" value={money(tolls)} />}
        <Line label="Total before tip" value={money(total)} className="total" />
        <Line label={`Tip at ${TIP_RATE * 100}% of the fare`} value={money(tip)} className="muted" />
      </div>

      <p className="inputs">
        {trip.miles} mi · {trip.minutes} min ({routeSource}) · {Math.round(conditions.temp_c)}°C /{' '}
        {Math.round(fahrenheit)}°F, {conditions.precip_mm} mm rain · {formatHour(conditions.hour)}{' '}
        {conditions.is_weekend ? 'weekend' : 'weekday'}
      </p>
    </section>
  );
}
