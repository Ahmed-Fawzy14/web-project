import { useState } from 'react';
import { Camera } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useAppState } from '../store/store';
import { AsyncButton, ErrorAlert, Field, SimulatedBadge, SuccessAlert, useCommand } from './ui';

export function QRDisplay({ title, token, hint }) {
  return (
    <div className="text-center">
      <h3 className="h6">{title}</h3>
      <div className="qr-frame">
        <QRCodeSVG value={token} size={148} fgColor="#0b2a5b" title={`QR code ${token}`} />
      </div>
      <p className="fw-bold mt-2 mb-1 font-monospace" data-testid="qr-token">{token}</p>
      {hint && <p className="small text-body-secondary mb-0">{hint}</p>}
    </div>
  );
}

/**
 * Camera scanning is simulated in Milestone 1: staff and couriers enter the
 * code, or use the labeled demo shortcut, and it is validated like a real scan.
 */
export function QRScanner({ title, onScan, testTokens = [], successText }) {
  const { demo } = useAppState();
  const [token, setToken] = useState('');
  const [cameraNote, setCameraNote] = useState(null);
  const [success, setSuccess] = useState(null);
  const { run, pending, error } = useCommand(onScan);

  const submit = async (event) => {
    event.preventDefault();
    setSuccess(null);
    const result = await run(token);
    if (result.ok) {
      setSuccess(result.message ?? successText ?? 'Code accepted.');
      setToken('');
    }
  };

  const openCamera = () => setCameraNote(
    demo.camera === 'denied'
      ? { tone: 'danger', text: 'Camera access is unavailable. Enter the code from the customer’s screen instead.' }
      : { tone: 'info', text: 'Camera scanning is simulated in this demo. Enter the code or use a demo code below.' },
  );

  return (
    <form onSubmit={submit} noValidate>
      <div className="d-flex justify-content-between align-items-center gap-2 mb-2">
        <h3 className="h6 mb-0">{title}</h3>
        <SimulatedBadge>Simulated scan</SimulatedBadge>
      </div>
      <button type="button" className="btn btn-outline-primary btn-sm mb-3 d-inline-flex align-items-center gap-1" onClick={openCamera}>
        <Camera size={14} aria-hidden="true" /> Open camera
      </button>
      {cameraNote && <div className={`alert alert-${cameraNote.tone} py-2 small`} role="status">{cameraNote.text}</div>}
      <Field label="QR code value">
        <input className="form-control font-monospace" value={token} autoComplete="off" onChange={(e) => setToken(e.target.value)} />
      </Field>
      {testTokens.length > 0 && (
        <div className="mb-3">
          <div className="small text-body-secondary mb-1">Demo codes</div>
          <div className="d-flex flex-wrap gap-1">
            {testTokens.map((test) => (
              <button key={test} type="button" className="btn btn-sm btn-light font-monospace" onClick={() => setToken(test)}>{test}</button>
            ))}
          </div>
        </div>
      )}
      <AsyncButton type="submit" pending={pending} disabled={!token.trim()} className="w-100">Validate code</AsyncButton>
      {error && <div className="mt-3"><ErrorAlert>{error}</ErrorAlert></div>}
      {success && <div className="mt-3"><SuccessAlert>{success}</SuccessAlert></div>}
    </form>
  );
}
