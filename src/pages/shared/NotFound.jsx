import { Compass } from 'lucide-react';
import { Link } from 'react-router-dom';
import { EmptyState } from '../../components/ui';

export default function NotFound() {
  return (
    <EmptyState icon={Compass} title="We could not find that page" action={<Link className="btn btn-primary" to="/">Back to home</Link>}>
      The link may be out of date, or this record may belong to another account.
    </EmptyState>
  );
}
