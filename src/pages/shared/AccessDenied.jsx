import { ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import { EmptyState } from '../../components/ui';
import { ROLE_HOME } from '../../domain/roles';
import { useAppState } from '../../store/store';

export default function AccessDenied() {
  const { session } = useAppState();
  return (
    <EmptyState
      icon={ShieldAlert}
      title="You do not have access to this page"
      action={<Link className="btn btn-primary" to={ROLE_HOME[session.activeRole] ?? '/login'}>Back to your dashboard</Link>}
    >
      This area is limited to authorized accounts.
    </EmptyState>
  );
}
