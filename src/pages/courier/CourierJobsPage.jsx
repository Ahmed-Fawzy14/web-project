import { useEffect, useState } from 'react';
import { PackageSearch } from 'lucide-react';
import { EmptyState, LoadingBlock, PageHeader, Stat } from '../../components/ui';
import { money } from '../../domain/format';
import { courierActiveJob, DELIVERY_STATUS, walletBalance } from '../../domain/orders';
import { useAppState, useCurrentUser } from '../../store/store';
import { JobCard } from './JobCard';

export default function CourierJobsPage() {
  const { orders, outlets, transactions, demo } = useAppState();
  const user = useCurrentUser();
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setLoaded(true), 300);
    return () => clearTimeout(timer);
  }, []);

  const outletOf = (order) => outlets.find((o) => o.id === order.outletId);
  const active = courierActiveJob(orders, user.id);
  const jobs = demo.jobsMode === 'empty' ? [] : orders
    .filter((o) => o.delivery?.status === DELIVERY_STATUS.OPEN && o.customerId !== user.id)
    .sort((a, b) => b.delivery.fee - a.delivery.fee);

  return (
    <>
      <PageHeader title="Orders available for pickup" subtitle="Accept the offered fee or send a counteroffer." />
      <div className="row g-3 mb-4">
        <div className="col-6 col-md-4"><Stat label="Wallet balance" value={money(walletBalance(transactions, user.id))} /></div>
        <div className="col-6 col-md-4"><Stat label="Completed deliveries" value={user.courierStats.completed} /></div>
      </div>

      {active && (
        <section className="mb-4">
          <h2 className="h5">Your active delivery</h2>
          <JobCard order={active} outlet={outletOf(active)} />
        </section>
      )}

      <h2 className="h5">Open jobs</h2>
      {!loaded && <LoadingBlock label="Loading jobs" />}
      {loaded && jobs.length === 0 && (
        <EmptyState icon={PackageSearch} title="No jobs right now">New delivery requests will appear here.</EmptyState>
      )}
      {loaded && (
        <div className="row g-3">
          {jobs.map((order) => (
            <div className="col-md-6" key={order.id}><JobCard order={order} outlet={outletOf(order)} /></div>
          ))}
        </div>
      )}
    </>
  );
}
