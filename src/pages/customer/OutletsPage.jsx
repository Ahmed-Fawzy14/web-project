import { useEffect, useState } from 'react';
import { SearchX, Store } from 'lucide-react';
import { Link } from 'react-router-dom';
import { OutletCard } from '../../components/orders';
import { Avatar, EmptyState, ErrorAlert, LoadingBlock } from '../../components/ui';
import { firstName, orderNumber } from '../../domain/format';
import { isActiveOrder } from '../../domain/orders';
import * as api from '../../store/api';
import { useAppState, useCurrentUser } from '../../store/store';

export default function OutletsPage() {
  const { outlets, orders, demo } = useAppState();
  const user = useCurrentUser();
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setLoaded(true), 300);
    return () => clearTimeout(timer);
  }, []);

  const active = orders.filter((o) => o.customerId === user.id && isActiveOrder(o));
  const term = query.trim().toLowerCase();
  const results = demo.outletsMode === 'empty' ? [] : outlets.filter((outlet) =>
    [outlet.name, outlet.code, outlet.cuisine, ...outlet.menu.map((i) => i.name)].some((text) => text.toLowerCase().includes(term)));

  return (
    <>
      <section className="hero d-flex align-items-center gap-3 mb-4">
        <Avatar name={user.name} large />
        <div>
          <h1 className="h4 mb-0">Hello, {firstName(user.name)}.</h1>
          <p className="mb-0">What are you craving today?</p>
        </div>
      </section>

      {active.length > 0 && (
        <div className="alert alert-primary d-flex flex-wrap justify-content-between align-items-center gap-2" role="status">
          <span>You have {active.length} active {active.length === 1 ? 'order' : 'orders'}, latest {orderNumber(active[active.length - 1].id)}.</span>
          <Link to="/orders" className="btn btn-sm btn-primary">Track orders</Link>
        </div>
      )}

      <div className="mb-3">
        <label htmlFor="outlet-search" className="form-label fw-semibold">Search outlets and dishes</label>
        <input id="outlet-search" type="search" className="form-control" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      {(!loaded || demo.outletsMode === 'loading') && <LoadingBlock label="Loading outlets" />}

      {loaded && demo.outletsMode === 'error' && (
        <div className="d-grid gap-2">
          <ErrorAlert>We could not load the outlets (simulated error).</ErrorAlert>
          <button type="button" className="btn btn-primary justify-self-start" onClick={() => api.setDemoControl('outletsMode', 'normal')}>Try again</button>
        </div>
      )}

      {loaded && ['normal', 'empty'].includes(demo.outletsMode) && (
        results.length > 0 ? (
          <div className="row g-3">
            {results.map((outlet) => (
              <div className="col-sm-6 col-lg-4" key={outlet.id}><OutletCard outlet={outlet} /></div>
            ))}
          </div>
        ) : (
          <EmptyState icon={term ? SearchX : Store} title={term ? 'No matches' : 'No outlets are open'}>
            {term ? 'Try a different outlet or dish.' : 'Check back soon.'}
          </EmptyState>
        )
      )}
    </>
  );
}
