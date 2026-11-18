import { Receipt } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { OrderListCard, OrderTimeline, QueueStatus } from '../../components/orders';
import { EmptyState, ErrorAlert, PageHeader } from '../../components/ui';
import { isActiveOrder } from '../../domain/orders';
import { useState } from 'react';
import * as api from '../../store/api';
import { useAppState, useCurrentUser } from '../../store/store';

export default function OrdersPage() {
  const { orders, outlets } = useAppState();
  const user = useCurrentUser();
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const outletOf = (order) => outlets.find((o) => o.id === order.outletId);

  const mine = orders.filter((o) => o.customerId === user.id).sort((a, b) => b.placedAt - a.placedAt);
  const active = mine.filter(isActiveOrder);
  const previous = mine.filter((o) => !isActiveOrder(o));

  const again = (order) => {
    const result = api.orderAgain(order.id);
    if (result.ok) navigate('/checkout');
    else setError(result.error);
  };

  return (
    <>
      <PageHeader title="My orders" subtitle="All times are estimates." />
      {error && <div className="mb-3"><ErrorAlert>{error}</ErrorAlert></div>}

      <section className="mb-4">
        <h2 className="h5">Current orders</h2>
        {active.length === 0 && (
          <EmptyState icon={Receipt} title="No orders in progress" action={<Link className="btn btn-primary" to="/">Browse outlets</Link>}>
            Your next order will appear here with its live queue position.
          </EmptyState>
        )}
        <div className="row g-3">
          {active.map((order) => (
            <div className="col-lg-6" key={order.id}>
              <article className="card h-100">
                <div className="card-body d-grid gap-3">
                  <div className="d-flex justify-content-between align-items-center gap-2">
                    <h3 className="h6 mb-0">{outletOf(order).name}</h3>
                    <Link className="btn btn-sm btn-outline-primary" to={`/orders/${order.id}`}>View details</Link>
                  </div>
                  <QueueStatus order={order} />
                  <OrderTimeline order={order} />
                </div>
              </article>
            </div>
          ))}
        </div>
      </section>

      {previous.length > 0 && (
        <section>
          <h2 className="h5">Previous orders</h2>
          <div className="row g-3">
            {previous.map((order) => (
              <div className="col-md-6" key={order.id}>
                <OrderListCard
                  order={order}
                  outlet={outletOf(order)}
                  actions={(
                    <>
                      <Link className="btn btn-sm btn-link" to={`/orders/${order.id}`}>View details</Link>
                      <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => again(order)}>Order again</button>
                    </>
                  )}
                />
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
