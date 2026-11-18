import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AsyncButton, ErrorAlert, Field, PageHeader, useCommand } from '../../components/ui';
import { idFileError } from '../../domain/validation';
import * as api from '../../store/api';
import { useCurrentUser } from '../../store/store';
import { RegistrationForm } from './RegistrationForm';

function CourierApplication({ user }) {
  const [idFile, setIdFile] = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  const [errors, setErrors] = useState({});
  const { run, pending, error } = useCommand(api.applyAsCourier);

  const submit = async (event) => {
    event.preventDefault();
    const nextErrors = {};
    const fileError = idFileError(idFile);
    if (fileError) nextErrors.idFile = fileError;
    if (!confirmed) nextErrors.confirmed = 'Confirm that you are a current AUC student.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length === 0) await run({ idFile, studentConfirmed: confirmed });
  };

  return (
    <form onSubmit={submit} noValidate>
      {user.verification.rejectReason && user.verification.courier === 'rejected' && (
        <div className="mb-3"><ErrorAlert>Your last application was not approved: {user.verification.rejectReason}</ErrorAlert></div>
      )}
      <Field label="Current student ID" error={errors.idFile} hint="JPG, PNG or PDF, up to 5 MB.">
        <input type="file" accept=".jpg,.jpeg,.png,.pdf" onChange={(e) => setIdFile(e.target.files[0] ?? null)} />
      </Field>
      <div className="form-check mb-3">
        <input id="current-student" type="checkbox" className={`form-check-input ${errors.confirmed ? 'is-invalid' : ''}`} checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
        <label className="form-check-label" htmlFor="current-student">I am a current AUC student</label>
        {errors.confirmed && <div className="invalid-feedback d-block">{errors.confirmed}</div>}
      </div>
      {error && <div className="mb-3"><ErrorAlert>{error}</ErrorAlert></div>}
      <AsyncButton type="submit" pending={pending} className="w-100">Submit for review</AsyncButton>
    </form>
  );
}

export default function CourierRegisterPage() {
  const user = useCurrentUser();
  const status = user?.verification.courier;

  return (
    <div className="row justify-content-center">
      <div className="col-md-8 col-lg-6">
        <PageHeader title="Become a student courier" subtitle="Earn 95% of every delivery fee on jobs you choose." />
        <div className="card p-4">
          {!user && <RegistrationForm courier />}
          {user && status === 'approved' && (
            <>
              <p>You are a verified courier.</p>
              <Link className="btn btn-primary" to="/courier">View available jobs</Link>
            </>
          )}
          {user && status === 'pending' && (
            <p className="mb-0" role="status">Your courier application is with the team for review. You can start once it is approved.</p>
          )}
          {user && (status === 'none' || status === 'rejected') && <CourierApplication user={user} />}
        </div>
      </div>
    </div>
  );
}
