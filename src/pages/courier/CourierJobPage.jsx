import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CampusMap } from '../../components/CampusMap';
import { CallButton } from '../../components/orders';
import { QRDisplay, QRScanner } from '../../components/QRHandoffPanel';
import { AsyncButton, ErrorAlert, Field, PageHeader, SuccessAlert, useCommand } from '../../components/ui';
import { getBuilding } from '../../data/campus';
import { money, orderNumber } from '../../domain/format';
import { courierActiveJob, courierEarning, DELIVERY_STATUS, ORDER_STATUS } from '../../domain/orders';
import { feeError } from '../../domain/validation';
import * as api from '../../store/api';
import { useAppState, useCurrentUser } from '../../store/store';
import NotFound from '../shared/NotFound';
import { JobCard } from './JobCard';

function OpenJobActions({ order, busy }) {
  const [counter, setCounter] = useState('');
  const [counterError, setCounterError] = useState(null);
  const [sent, setSent] = useState(false);
  const accept = useCommand(api.acceptJob);
  const offer = useCommand(api.submitCounteroffer);

  const submitCounter = async (event) => {
    event.preventDefault();
    const problem = feeError(counter);
    setCounterError(problem);
    if (problem) return;
    setSent((await offer.run(order.id, counter)).ok);
  };

  return (
    <div className="card p-3 d-grid gap-3">
      {busy && <ErrorAlert>Finish your active delivery before taking another job.</ErrorAlert>}
      <AsyncButton pending={accept.pending} disabled={busy} onClick={() => accept.run(order.id)}>Accept {money(order.delivery.fee)}</AsyncButton>
      {accept.error && <ErrorAlert>{accept.error}</ErrorAlert>}
      <form onSubmit={submitCounter} noValidate>
        <Field label="Or counteroffer (EGP)" error={counterError} hint="The customer must accept your price before you are assigned.">
          <input type="number" inputMode="numeric" value={counter} onChange={(e) => { setCounter(e.target.value); setSent(false); }} />
        </Field>
        <AsyncButton type="submit" variant="outline-primary" pending={offer.pending} disabled={busy} className="w-100">Send counteroffer</AsyncButton>
      </form>
      {offer.error && <ErrorAlert>{offer.error}</ErrorAlert>}
      {sent && <SuccessAlert>Counteroffer sent. You will be notified if the customer accepts.</SuccessAlert>}
    </div>
  );
}

function ActiveJobActions({ order, customer }) {
  const { delivery } = order;
  const cancel = useCommand(api.courierCancelJob);
  const pickedUp = delivery.status === DELIVERY_STATUS.PICKED_UP;
  const ready = order.status === ORDER_STATUS.READY;

  return (
    <div className="d-grid gap-3">
      <div className="card p-3">
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
          <span className="fw-semibold">{customer.name}</span>
          <CallButton phone={customer.phone} label="Call customer" />
        </div>
        <p className="small mb-0">{delivery.address.directions}</p>
      </div>

      {!pickedUp && (
        <div className="card p-3">
          <QRDisplay
            title="Your pickup QR"
            token={delivery.pickupToken}
            hint={ready ? 'Show this code to outlet staff.' : 'Wait until the outlet marks this order Ready.'}
          />
          {!delivery.feePaid && <p className="small text-warning-emphasis mt-2 mb-0" role="status">Waiting for the customer to pay the delivery fee.</p>}
          <button type="button" className="btn btn-outline-danger btn-sm mt-3" disabled={cancel.pending} onClick={() => cancel.run(order.id)}>Cancel this job</button>
          {cancel.error && <div className="mt-2"><ErrorAlert>{cancel.error}</ErrorAlert></div>}
        </div>
      )}

      {pickedUp && (
        <div className="card p-3">
          <QRScanner
            title="Scan the customer’s delivery QR"
            onScan={(token) => api.scanDeliveryCode(order.id, token)}
            testTokens={[delivery.deliveryToken, delivery.pickupToken]}
            successText="Delivery confirmed. Your earnings are in your wallet."
          />
        </div>
      )}
    </div>
  );
}

export default function CourierJobPage() {
  const { id } = useParams();
  const { orders, outlets, users } = useAppState();
  const user = useCurrentUser();
  const order = orders.find((o) => o.id === id && o.delivery);
  if (!order) return <NotFound />;

  const outlet = outlets.find((o) => o.id === order.outletId);
  const { delivery } = order;
  const mine = delivery.courierId === user.id;
  const isOpen = delivery.status === DELIVERY_STATUS.OPEN;
  const delivered = mine && delivery.status === DELIVERY_STATUS.DELIVERED;
  const active = courierActiveJob(orders, user.id);

  return (
    <>
      <PageHeader title={`Job ${orderNumber(order.id)}`} subtitle={outlet.name} backTo="/courier" backLabel="All jobs" />
      <div className="row g-4">
        <div className="col-lg-7 d-grid gap-3 align-content-start">
          <JobCard order={order} outlet={outlet}><span /></JobCard>
          <CampusMap pin={delivery.address.pin} outletPoint={getBuilding(outlet.buildingId)} label="Route from the outlet to the drop-off pin." />
        </div>
        <div className="col-lg-5">
          {isOpen && <OpenJobActions order={order} busy={Boolean(active)} />}
          {mine && [DELIVERY_STATUS.ASSIGNED, DELIVERY_STATUS.PICKED_UP].includes(delivery.status) && (
            <ActiveJobActions order={order} customer={users.find((u) => u.id === order.customerId)} />
          )}
          {delivered && (
            <div className="d-grid gap-3">
              <SuccessAlert>Delivered. {money(courierEarning(delivery.fee))} was added to your wallet after the 5% commission.</SuccessAlert>
              <Link className="btn btn-primary" to="/wallet">Open wallet</Link>
            </div>
          )}
          {!isOpen && !mine && <ErrorAlert>Another courier has taken this job, so it is no longer available.</ErrorAlert>}
        </div>
      </div>
    </>
  );
}
