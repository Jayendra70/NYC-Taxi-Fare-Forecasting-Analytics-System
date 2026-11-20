function Stop({ kind, label, point }) {
  let value = 'Click the map';
  if (point) value = point.zone ? `${point.zone.name}, ${point.zone.borough}` : 'Finding zone…';

  return (
    <div className={`stop ${kind} ${point ? 'set' : ''}`}>
      <span className="dot" />
      <div>
        <div className="stop-label">{label}</div>
        <div className="stop-value">{value}</div>
      </div>
    </div>
  );
}

export default function TripCard({ pickup, dropoff }) {
  return (
    <div className="stops">
      <Stop kind="pickup" label="Pickup" point={pickup} />
      <span className="arrow">→</span>
      <Stop kind="dropoff" label="Drop-off" point={dropoff} />
    </div>
  );
}
