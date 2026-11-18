import { Link, Navigate } from 'react-router-dom';
import { useCurrentUser } from '../../store/store';
import { RegistrationForm } from './RegistrationForm';

export default function RegisterPage() {
  const user = useCurrentUser();
  if (user) return <Navigate to="/account-status" replace />;
  return (
    <div className="row justify-content-center">
      <div className="col-md-8 col-lg-6">
        <div className="card p-4">
          <h1 className="h3">Create your account</h1>
          <p className="text-body-secondary">OtlobAUC is for AUC students, faculty and alumni. The team reviews each ID before ordering opens.</p>
          <RegistrationForm />
          <p className="small text-center mt-3 mb-0">Already registered? <Link to="/login">Sign in</Link></p>
        </div>
      </div>
    </div>
  );
}
