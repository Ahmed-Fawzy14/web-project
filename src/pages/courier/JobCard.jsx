import { MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import { OrderStatusBadge } from '../../components/orders';
import { money, orderNumber } from '../../domain/format';
import { courierEarning, destinationLabel, summarizeLines } from '../../domain/orders';

export function JobCard({ order, outlet, children }) {
  const { delivery } = order;
  return (
    <article className="card h-100">
      <div className="card-body d-grid gap-2">
        <div className="d-flex justify-content-between gap-2">
          <h3 className="h6 mb-0">{outlet.name}</h3>
          <OrderStatusBadge order={order} />
        </div>
        <div className="fw-semibold">{summarizeLines(order.lines)}</div>
        <div className="small text-body-secondary d-flex gap-1">
          <MapPin size={15} className="flex-shrink-0" aria-hidden="true" /> {destinationLabel(delivery)}
        </div>
        <div className="d-flex flex-wrap justify-content-between align-items-end gap-2">
          <div>
            <div className="small text-body-secondary">Offered {money(delivery.fee)}</div>
            <strong className="text-success fs-5">You earn {money(courierEarning(delivery.fee))}</strong>
          </div>
          <div className="d-flex flex-wrap gap-2">
            {children ?? <Link className="btn btn-sm btn-primary" to={`/courier/jobs/${order.id}`}>View job {orderNumber(order.id)}</Link>}
          </div>
        </div>
      </div>
    </article>
  );
}
