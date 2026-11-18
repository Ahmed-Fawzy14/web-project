import { useNavigate } from 'react-router-dom';
import * as api from '../store/api';
import { useAppState } from '../store/store';
import { Modal, SimulatedBadge } from './ui';

const CONTROLS = [
  { key: 'paymentOutcome', label: 'Payments, refunds and withdrawals', options: [['success', 'Succeed'], ['fail', 'Fail']] },
  { key: 'outletsMode', label: 'Outlet list', options: [['normal', 'Normal'], ['loading', 'Loading'], ['error', 'Error'], ['empty', 'Empty']] },
  { key: 'jobsMode', label: 'Courier job list', options: [['normal', 'Normal'], ['empty', 'Empty']] },
  { key: 'camera', label: 'Camera permission', options: [['available', 'Available'], ['denied', 'Denied']] },
  { key: 'microphone', label: 'Microphone permission', options: [['available', 'Available'], ['denied', 'Denied']] },
  { key: 'location', label: 'Location permission', options: [['available', 'Available'], ['denied', 'Denied']] },
];

export function DemoControls({ open, onClose }) {
  const { demo } = useAppState();
  const navigate = useNavigate();

  const reset = () => {
    api.resetDemo();
    onClose();
    navigate('/login');
  };

  return (
    <Modal title="Demo controls" open={open} onClose={onClose}>
      <p className="small text-body-secondary">
        <SimulatedBadge /> These switches force mock outcomes so every state can be demonstrated.
      </p>
      {CONTROLS.map(({ key, label, options }) => (
        <div className="mb-3" key={key}>
          <label className="form-label fw-semibold small" htmlFor={`demo-${key}`}>{label}</label>
          <select id={`demo-${key}`} className="form-select" value={demo[key]} onChange={(e) => api.setDemoControl(key, e.target.value)}>
            {options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
          </select>
        </div>
      ))}
      <div className="form-check mb-3">
        <input
          id="demo-competing"
          type="checkbox"
          className="form-check-input"
          checked={demo.competingCourier}
          onChange={(e) => api.setDemoControl('competingCourier', e.target.checked)}
        />
        <label className="form-check-label" htmlFor="demo-competing">Another courier wins the next job acceptance</label>
      </div>
      <button type="button" className="btn btn-outline-danger w-100" onClick={reset}>Reset all demo data</button>
    </Modal>
  );
}
