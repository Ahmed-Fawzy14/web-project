import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AsyncButton, ErrorAlert, Field, SimulatedBadge, useCommand } from '../../components/ui';
import { validateRegistration } from '../../domain/validation';
import * as api from '../../store/api';

const initial = { name: '', affiliation: 'student', noAucEmail: false, email: '', phone: '', password: '', confirm: '', idFile: null };

export function RegistrationForm({ courier = false }) {
  const navigate = useNavigate();
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState({});
  const { run, pending, error } = useCommand(api.register);

  const set = (key, value) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const submit = async (event) => {
    event.preventDefault();
    const nextErrors = validateRegistration(values, { courier });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    const result = await run(values, { courier });
    if (result.ok) navigate('/account-status');
  };

  const isAlumni = !courier && values.affiliation === 'alumni';

  return (
    <form onSubmit={submit} noValidate>
      <Field label="Full name" error={errors.name}>
        <input autoComplete="name" value={values.name} onChange={(e) => set('name', e.target.value)} />
      </Field>
      {!courier && (
        <Field label="AUC affiliation">
          <select className="form-select" value={values.affiliation} onChange={(e) => set('affiliation', e.target.value)}>
            <option value="student">Student</option>
            <option value="faculty">Faculty</option>
            <option value="alumni">Alumni</option>
          </select>
        </Field>
      )}
      {isAlumni && (
        <div className="form-check mb-3">
          <input id="no-auc-email" type="checkbox" className="form-check-input" checked={values.noAucEmail} onChange={(e) => set('noAucEmail', e.target.checked)} />
          <label className="form-check-label" htmlFor="no-auc-email">I no longer have access to my AUC email</label>
        </div>
      )}
      <Field label={isAlumni && values.noAucEmail ? 'Personal email' : 'AUC email'} error={errors.email}>
        <input type="email" autoComplete="email" placeholder={isAlumni && values.noAucEmail ? 'you@example.com' : 'you@aucegypt.edu'} value={values.email} onChange={(e) => set('email', e.target.value)} />
      </Field>
      <Field label="Contact phone" error={errors.phone}>
        <input type="tel" autoComplete="tel" placeholder="01005550123" value={values.phone} onChange={(e) => set('phone', e.target.value)} />
      </Field>
      <div className="row g-3">
        <div className="col-sm-6">
          <Field label="Password" error={errors.password} hint="Demo only. Use a made-up password, it is never saved.">
            <input type="password" autoComplete="new-password" value={values.password} onChange={(e) => set('password', e.target.value)} />
          </Field>
        </div>
        <div className="col-sm-6">
          <Field label="Confirm password" error={errors.confirm}>
            <input type="password" autoComplete="new-password" value={values.confirm} onChange={(e) => set('confirm', e.target.value)} />
          </Field>
        </div>
      </div>
      <Field label={courier ? 'Current student ID' : isAlumni ? 'Alumni ID' : 'AUC ID'} error={errors.idFile} hint="JPG, PNG or PDF, up to 5 MB.">
        <input type="file" accept=".jpg,.jpeg,.png,.pdf" onChange={(e) => set('idFile', e.target.files[0] ?? null)} />
      </Field>
      <p className="small text-body-secondary">
        <SimulatedBadge>Simulated verification</SimulatedBadge> Only the file name is kept. The team reviews it in the admin view.
      </p>
      {error && <div className="mb-3"><ErrorAlert>{error}</ErrorAlert></div>}
      <AsyncButton type="submit" pending={pending} className="w-100">Submit for review</AsyncButton>
    </form>
  );
}
