import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { AsyncButton, ErrorAlert, Field, SimulatedBadge, useCommand } from '../../components/ui';
import { DEMO_PASSWORD } from '../../data/seed';
import { ROLE_HOME } from '../../domain/roles';
import * as api from '../../store/api';
import { useAppState, useCurrentUser } from '../../store/store';

const DEMO_ACCOUNTS = [
  ['u-salma', 'Customer'],
  ['u-karim', 'Courier and customer'],
  ['u-mariam', 'Courier and customer'],
  ['u-lina', 'Staff, Nile Bean Café'],
  ['u-tarek', 'Staff, Lotus Wok'],
  ['u-dina', 'Staff, Baladi Corner'],
  ['u-admin', 'Admin'],
];

export default function LoginPage() {
  const { users, session } = useAppState();
  const user = useCurrentUser();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const { run, pending, error } = useCommand(api.login);

  if (user) return <Navigate to={ROLE_HOME[session.activeRole] ?? '/'} replace />;

  const submit = async (event) => {
    event.preventDefault();
    const nextErrors = {};
    if (!email.trim()) nextErrors.email = 'Enter your email address.';
    if (!password) nextErrors.password = 'Enter your password.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    await run(email, password);
  };

  const signInDemo = (id) => {
    const result = api.signInAsDemoUser(id);
    navigate(ROLE_HOME[result.activeRole]);
  };

  return (
    <div className="row justify-content-center g-4">
      <div className="col-md-6 col-lg-5">
        <div className="card p-4">
          <h1 className="h3">Sign in to OtlobAUC</h1>
          <p className="text-body-secondary">See your place in the queue, or have food brought to you.</p>
          <form onSubmit={submit} noValidate>
            <Field label="Email" error={errors.email}>
              <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field label="Password" error={errors.password}>
              <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
            {error && <div className="mb-3"><ErrorAlert>{error}</ErrorAlert></div>}
            <AsyncButton type="submit" pending={pending} className="w-100">Sign in</AsyncButton>
          </form>
          <p className="small text-center mt-3 mb-1">New here? <Link to="/register">Create an account</Link></p>
          <p className="small text-center mb-0">Current student? <Link to="/courier/register">Register as a courier</Link></p>
        </div>
      </div>
      <div className="col-md-6 col-lg-5">
        <div className="card p-4">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <h2 className="h5 mb-0">Demo accounts</h2>
            <SimulatedBadge>Fictional</SimulatedBadge>
          </div>
          <p className="small text-body-secondary">Password for all demo accounts: <code>{DEMO_PASSWORD}</code></p>
          <div className="list-group">
            {DEMO_ACCOUNTS.map(([id, role]) => {
              const account = users.find((u) => u.id === id);
              return (
                <button key={id} type="button" className="list-group-item list-group-item-action" onClick={() => signInDemo(id)}>
                  <span className="fw-semibold d-block">{account.name}</span>
                  <span className="small text-body-secondary">{role}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
