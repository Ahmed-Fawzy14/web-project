import { useState } from 'react';
import { Clock3 } from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';
import { AsyncButton, ErrorAlert, Field, useCommand } from '../../components/ui';
import { idFileError } from '../../domain/validation';
import * as api from '../../store/api';
import { useCurrentUser } from '../../store/store';

export default function AccountStatusPage() {
  const user = useCurrentUser();
  const [idFile, setIdFile] = useState(null);
  const [fileError, setFileError] = useState(null);
  const { run, pending, error } = useCommand(api.resubmitId);

  if (!user) return <Navigate to="/login" replace />;
  const status = user.verification.customer;

  const resubmit = async (event) => {
    event.preventDefault();
    const nextError = idFileError(idFile);
    setFileError(nextError);
    if (!nextError) await run(idFile);
  };

  return (
    <div className="row justify-content-center">
      <div className="col-md-8 col-lg-6">
        <div className="card p-4">
          {status === 'pending' && (
            <div className="text-center" role="status">
              <Clock3 size={34} className="text-gold mb-2" aria-hidden="true" />
              <h1 className="h4">Your ID is being reviewed</h1>
              <p className="text-body-secondary">Thanks, {user.name}. You can order as soon as the team approves <strong>{user.verification.idFileName}</strong>.</p>
              <p className="small text-body-secondary mb-0">To test this, switch to the Admin demo role and approve the application.</p>
            </div>
          )}
          {status === 'approved' && (
            <div className="text-center">
              <h1 className="h4">Your account is approved</h1>
              <Link className="btn btn-primary mt-2" to="/">Browse outlets</Link>
            </div>
          )}
          {status === 'rejected' && (
            <form onSubmit={resubmit} noValidate>
              <h1 className="h4">We could not approve your ID</h1>
              <div className="mb-3"><ErrorAlert>{user.verification.rejectReason}</ErrorAlert></div>
              <Field label="Upload a new ID" error={fileError} hint="JPG, PNG or PDF, up to 5 MB.">
                <input type="file" accept=".jpg,.jpeg,.png,.pdf" onChange={(e) => setIdFile(e.target.files[0] ?? null)} />
              </Field>
              {error && <div className="mb-3"><ErrorAlert>{error}</ErrorAlert></div>}
              <AsyncButton type="submit" pending={pending} className="w-100">Resubmit for review</AsyncButton>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
