import { Map, Marker } from 'pigeon-maps';

const MIDTOWN = [40.73, -73.98];

export default function MapPicker({ pickup, dropoff, onPick }) {
  return (
    <div className="map">
      <Map height={420} defaultCenter={MIDTOWN} defaultZoom={11} onClick={({ latLng }) => onPick(latLng)}>
        {pickup && <Marker width={40} anchor={[pickup.lat, pickup.lng]} color="#3b82f6" />}
        {dropoff && <Marker width={40} anchor={[dropoff.lat, dropoff.lng]} color="#10b981" />}
      </Map>
    </div>
  );
}
