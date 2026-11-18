import { Bike, MapPin, Store } from 'lucide-react';
import { BUILDINGS } from '../data/campus';
import { SimulatedBadge } from './ui';

/**
 * A schematic campus map. Building markers are real buttons, so a pin can be
 * chosen with the keyboard as well as by clicking anywhere on the map.
 */
export function CampusMap({ pin, onPick, outletPoint, courierPoint, label = 'Simulated campus map' }) {
  const interactive = Boolean(onPick);

  const clickMap = (event) => {
    if (!interactive || event.target.closest('button')) return;
    const box = event.currentTarget.getBoundingClientRect();
    onPick({
      x: Math.round(((event.clientX - box.left) / box.width) * 100),
      y: Math.round(((event.clientY - box.top) / box.height) * 100),
    });
  };

  return (
    <figure className="mb-2">
      {/* Clicking is a shortcut. The building buttons below provide the keyboard path. */}
      <div className={`campus-map ${interactive ? 'interactive' : ''}`} onClick={clickMap} data-testid="campus-map">
        {BUILDINGS.map((building) => (
          interactive ? (
            <button
              key={building.id}
              type="button"
              className="map-building"
              style={{ left: `${building.x}%`, top: `${building.y}%` }}
              onClick={() => onPick({ x: building.x, y: building.y }, building.id)}
            >
              {building.name}
            </button>
          ) : (
            <span key={building.id} className="map-building" style={{ left: `${building.x}%`, top: `${building.y}%` }}>
              {building.name}
            </span>
          )
        ))}
        {outletPoint && (
          <span className="map-marker marker-outlet" style={{ left: `${outletPoint.x}%`, top: `${outletPoint.y}%` }} title="Outlet">
            <Store size={15} aria-label="Outlet" />
          </span>
        )}
        {pin && (
          <span className="map-marker marker-pin" style={{ left: `${pin.x}%`, top: `${pin.y}%` }} title="Delivery pin" data-testid="map-pin">
            <MapPin size={17} aria-label="Delivery pin" />
          </span>
        )}
        {courierPoint && (
          <span className="map-marker marker-courier" style={{ left: `${courierPoint.x}%`, top: `${courierPoint.y}%` }} title="Courier demo location">
            <Bike size={15} aria-label="Courier demo location" />
          </span>
        )}
      </div>
      <figcaption className="small text-body-secondary mt-1"><SimulatedBadge>Demo data</SimulatedBadge> {label}</figcaption>
    </figure>
  );
}
