import { useState } from 'react';
import { LocateFixed } from 'lucide-react';
import { BUILDINGS, getBuilding } from '../data/campus';
import { useAppState } from '../store/store';
import { CampusMap } from './CampusMap';
import { ErrorAlert, Field } from './ui';

export const emptyAddress = { pin: null, buildingId: '', floor: '', room: '', directions: '' };

export function AddressForm({ address, onChange, errors, outletPoint }) {
  const { demo } = useAppState();
  const [locationError, setLocationError] = useState(null);
  const set = (key, value) => onChange({ ...address, [key]: value });

  const pick = (pin, buildingId) => onChange({ ...address, pin, buildingId: buildingId ?? address.buildingId });
  const chooseBuilding = (buildingId) => {
    const building = getBuilding(buildingId);
    onChange({ ...address, buildingId, pin: building ? { x: building.x, y: building.y } : address.pin });
  };

  const useMyLocation = () => {
    if (demo.location === 'denied') {
      setLocationError('Location access is unavailable. Tap the map or choose your building below instead.');
      return;
    }
    setLocationError(null);
    chooseBuilding('library');
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-2">
        <span className="form-label fw-semibold mb-0">Drop-off pin</span>
        <button type="button" className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1" onClick={useMyLocation}>
          <LocateFixed size={14} aria-hidden="true" /> Use my location
        </button>
      </div>
      <CampusMap pin={address.pin} onPick={pick} outletPoint={outletPoint} label="Choose a building or tap the map to drop your pin." />
      {errors.pin && <div className="invalid-feedback d-block mb-2">{errors.pin}</div>}
      {locationError && <div className="mb-3"><ErrorAlert>{locationError}</ErrorAlert></div>}

      <Field label="Building" error={errors.buildingId}>
        <select className="form-select" value={address.buildingId} onChange={(e) => chooseBuilding(e.target.value)}>
          <option value="">Choose a building</option>
          {BUILDINGS.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </Field>
      <div className="row g-3">
        <div className="col-sm-4">
          <Field label="Floor" error={errors.floor}>
            <input value={address.floor} onChange={(e) => set('floor', e.target.value)} />
          </Field>
        </div>
        <div className="col-sm-8">
          <Field label="Room or meeting point" error={errors.room}>
            <input value={address.room} placeholder="e.g. CP 40" onChange={(e) => set('room', e.target.value)} />
          </Field>
        </div>
      </div>
      <Field label="Directions" error={errors.directions}>
        <textarea rows={2} value={address.directions} placeholder="e.g. Lab door facing the courtyard" onChange={(e) => set('directions', e.target.value)} />
      </Field>
    </div>
  );
}
