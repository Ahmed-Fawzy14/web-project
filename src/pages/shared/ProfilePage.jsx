import { useState } from 'react';
import { AsyncButton, Avatar, ErrorAlert, Field, PageHeader, SuccessAlert, useCommand } from '../../components/ui';
import { phoneError } from '../../domain/validation';
import * as api from '../../store/api';
import { useCurrentUser } from '../../store/store';

export default function ProfilePage() {
  const user = useCurrentUser();
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone);
  const [errors, setErrors] = useState({});
  const [saved, setSaved] = useState(false);
  const { run, pending, error } = useCommand(api.updateProfile);

  const submit = async (event) => {
    event.preventDefault();
    setSaved(false);
    const nextErrors = {};
    if (!name.trim()) nextErrors.name = 'Enter your full name.';
    const phoneProblem = phoneError(phone);
    if (phoneProblem) nextErrors.phone = phoneProblem;
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    setSaved((await run({ name, phone })).ok);
  };

  return (
    <div className="row justify-content-center">
      <div className="col-md-8 col-lg-6">
        <PageHeader title="Edit profile" />
        <form className="card p-4" onSubmit={submit} noValidate>
          <div className="d-flex align-items-center gap-3 mb-3">
            <Avatar name={name || '?'} large />
            <div>
              <div className="fw-bold">{user.email}</div>
              <div className="small text-body-secondary text-capitalize">{user.affiliation} · {user.roles.join(' and ')}</div>
            </div>
          </div>
          <Field label="Full name" error={errors.name}>
            <input autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Contact phone" error={errors.phone} hint="Couriers and customers use this number to call each other.">
            <input type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
          {error && <div className="mb-3"><ErrorAlert>{error}</ErrorAlert></div>}
          {saved && <div className="mb-3"><SuccessAlert>Profile saved.</SuccessAlert></div>}
          <AsyncButton type="submit" pending={pending}>Save changes</AsyncButton>
        </form>
      </div>
    </div>
  );
}
