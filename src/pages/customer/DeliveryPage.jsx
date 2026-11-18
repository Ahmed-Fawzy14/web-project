import { useState } from 'react';
import { Star } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { AddressForm, emptyAddress } from '../../components/AddressForm';
import { CampusMap } from '../../components/CampusMap';
import { CallButton, DeliveryBidCard, Reliability } from '../../components/orders';
import { PaymentPanel, RefundChoice } from '../../components/PaymentPanel';
import { QRDisplay } from '../../components/QRHandoffPanel';
import { AsyncButton, ErrorAlert, Field, Modal, PageHeader, RadioCards, StatusBadge, SuccessAlert, useCommand } from '../../components/ui';
import { getBuilding, MINIMUM_DELIVERY_FEE, suggestDeliveryFee, walkingMinutes } from '../../data/campus';
import { money, orderNumber } from '../../domain/format';
import { deliveryBadge, destinationLabel, DELIVERY_STATUS, editLock, ORDER_STATUS } from '../../domain/orders';
import { feeError, validateAddress } from '../../domain/validation';
import * as api from '../../store/api';
import { useAppState, useCurrentUser } from '../../store/store';
import NotFound from '../shared/NotFound';

const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

/** Demo courier movement, derived from the delivery stage and time. */
function demoCourierPoint(delivery, outletPoint, now) {
  const start = { x: 8, y: 8 };
  if (delivery.status === DELIVERY_STATUS.ASSIGNED) {
    return lerp(start, outletPoint, Math.min(1, (now - delivery.assignedAt) / 180_000));
  }
  const walk = delivery.walkMinutes * 60_000;
  return lerp(outletPoint, delivery.address.pin, Math.min(1, (now - delivery.pickedUpAt) / walk));
}

function RequestForm({ order, outletPoint }) {
  const [address, setAddress] = useState(emptyAddress);
  const [fee, setFee] = useState(null);
  const [errors, setErrors] = useState({});
  const { run, pending, error } = useCommand(api.postDelivery);

  const minutes = address.pin ? walkingMinutes(outletPoint, address.pin) : null;
  const suggested = minutes ? suggestDeliveryFee(minutes) : null;
  const offered = fee ?? (suggested ? String(suggested) : '');

  const submit = async (event) => {
    event.preventDefault();
    const nextErrors = validateAddress(address);
    const problem = feeError(offered, { minimum: MINIMUM_DELIVERY_FEE });
    if (problem) nextErrors.fee = problem;
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length === 0) await run(order.id, address, Number(offered));
  };

  return (
    <form className="card p-3" onSubmit={submit} noValidate>
      <h2 className="h5">Where should we bring it?</h2>
      <AddressForm address={address} onChange={setAddress} errors={errors} outletPoint={outletPoint} />
      <Field
        label="Delivery fee you offer (EGP)"
        error={errors.fee}
        hint={suggested ? `Suggested ${money(suggested)}: minimum fee plus about ${minutes} min of walking. You can change it.` : 'Drop your pin to see a suggested fee.'}
      >
        <input type="number" inputMode="numeric" min={MINIMUM_DELIVERY_FEE} value={offered} onChange={(e) => setFee(e.target.value)} />
      </Field>
      <p className="small text-body-secondary">Your food is already in the queue. The delivery fee is paid separately once a courier is assigned.</p>
      {error && <div className="mb-3"><ErrorAlert>{error}</ErrorAlert></div>}
      <AsyncButton type="submit" pending={pending} className="w-100">Post delivery request</AsyncButton>
    </form>
  );
}

function OpenRequest({ order, users }) {
  const { delivery } = order;
  const [fee, setFee] = useState('');
  const [feeProblem, setFeeProblem] = useState(null);
  const raise = useCommand(api.raiseDeliveryFee);
  const respond = useCommand((action, bidId) => action(order.id, bidId));
  const collect = useCommand(api.collectMyself);
  const bids = delivery.bids.filter((b) => b.state === 'pending');

  const submitRaise = async (event) => {
    event.preventDefault();
    const problem = feeError(fee, { minimum: delivery.fee + 1 });
    setFeeProblem(problem);
    if (!problem && (await raise.run(order.id, fee)).ok) setFee('');
  };

  return (
    <div className="d-grid gap-3">
      <section className="card p-3">
        <h2 className="h5">Offers from couriers</h2>
        <p className="text-body-secondary small">You offered <strong>{money(delivery.fee)}</strong>. A courier who accepts this price is assigned right away.</p>
        {bids.length === 0 && <p className="mb-0" role="status">Waiting for couriers to respond.</p>}
        <div className="d-grid gap-2">
          {bids.map((bid) => (
            <DeliveryBidCard
              key={bid.id}
              bid={bid}
              courier={users.find((u) => u.id === bid.courierId)}
              pending={respond.pending}
              onAccept={() => respond.run(api.acceptBid, bid.id)}
              onDecline={() => respond.run(api.declineBid, bid.id)}
            />
          ))}
        </div>
        {respond.error && <div className="mt-3"><ErrorAlert>{respond.error}</ErrorAlert></div>}
      </section>

      <form className="card p-3" onSubmit={submitRaise} noValidate>
        <h2 className="h6">Raise your offer</h2>
        <div className="row g-2 align-items-start">
          <div className="col">
            <Field label="New fee (EGP)" error={feeProblem} className="mb-0">
              <input type="number" inputMode="numeric" value={fee} onChange={(e) => setFee(e.target.value)} />
            </Field>
          </div>
          <div className="col-auto pt-4 mt-2">
            <AsyncButton type="submit" variant="outline-primary" pending={raise.pending}>Raise fee</AsyncButton>
          </div>
        </div>
        {raise.error && <div className="mt-2"><ErrorAlert>{raise.error}</ErrorAlert></div>}
      </form>

      <section className="card p-3">
        <h2 className="h6">Changed your mind?</h2>
        <p className="small text-body-secondary">Leave this request open, or collect the order yourself.</p>
        <AsyncButton variant="outline-secondary" pending={collect.pending} onClick={() => collect.run(order.id)}>I will collect it myself</AsyncButton>
        {collect.error && <div className="mt-2"><ErrorAlert>{collect.error}</ErrorAlert></div>}
      </section>
    </div>
  );
}

function CancelDeliveryModal({ order, orders, onClose }) {
  const lock = editLock(order, orders);
  const [scope, setScope] = useState('delivery');
  const [method, setMethod] = useState('card');
  const [destination, setDestination] = useState(order.payment.method === 'wallet' ? 'wallet' : 'original');
  const { run, pending, error } = useCommand(api.customerCancelDelivery, { delay: 500 });
  const { delivery } = order;
  const scopes = [
    { value: 'delivery', label: 'Delivery only' },
    ...(lock.allowed ? [{ value: 'order', label: 'Entire order' }] : []),
  ];

  const confirm = async () => {
    if ((await run(order.id, { scope, method, destination })).ok) onClose();
  };

  return (
    <Modal
      title="Cancel this delivery?"
      open
      onClose={onClose}
      footer={(
        <>
          <button type="button" className="btn btn-outline-secondary" onClick={onClose}>Keep delivery</button>
          <AsyncButton variant="danger" pending={pending} onClick={confirm}>Confirm cancellation</AsyncButton>
        </>
      )}
    >
      <p>A courier is assigned, so the agreed {money(delivery.fee)} is still owed: 95% goes to the courier and 5% to the platform.</p>
      <RadioCards legend="What should be cancelled?" name="cancel-scope" value={scope} options={scopes} onChange={setScope} />
      {!lock.allowed && <p className="small text-body-secondary">Food cancellation has closed for this order.</p>}
      {!delivery.feePaid && <PaymentPanel name="cancel-fee" method={method} onChange={setMethod} amount={delivery.fee} />}
      {scope === 'order' && <div className="mt-3"><RefundChoice name="cancel-food" value={destination} onChange={setDestination} originalMethod={order.payment.method} /></div>}
      {error && <div className="mt-3"><ErrorAlert>{error}</ErrorAlert></div>}
    </Modal>
  );
}

function ActiveDelivery({ order, outletPoint, users, now, orders }) {
  const { delivery } = order;
  const courier = users.find((u) => u.id === delivery.courierId);
  const [method, setMethod] = useState('card');
  const [cancelling, setCancelling] = useState(false);
  const pay = useCommand(api.payDeliveryFee, { delay: 500 });
  const pickedUp = delivery.status === DELIVERY_STATUS.PICKED_UP;

  return (
    <div className="row g-3">
      <div className="col-lg-7 d-grid gap-3 align-content-start">
        <section className="card p-3">
          <div className="d-flex flex-wrap justify-content-between gap-2 mb-2">
            <div>
              <h2 className="h5 mb-1">{courier.name}</h2>
              <Reliability courier={courier} />
            </div>
            <CallButton phone={courier.phone} label="Call courier" />
          </div>
          <CampusMap pin={delivery.address.pin} outletPoint={outletPoint} courierPoint={demoCourierPoint(delivery, outletPoint, now)} label="Courier location is demo data." />
          <p className="small mb-0"><strong>Deliver to:</strong> {destinationLabel(delivery)}. {delivery.address.directions}</p>
          <p className="small text-body-secondary mb-0">The destination is locked now that a courier is assigned.</p>
        </section>
      </div>

      <div className="col-lg-5 d-grid gap-3 align-content-start">
        {!delivery.feePaid && (
          <section className="card p-3">
            <h2 className="h6">Pay your delivery fee</h2>
            <PaymentPanel name="delivery-fee" method={method} onChange={setMethod} amount={delivery.fee} />
            {pay.error && <div className="mt-2"><ErrorAlert>{pay.error}</ErrorAlert></div>}
            <AsyncButton className="w-100 mt-3" pending={pay.pending} onClick={() => pay.run(order.id, method)}>Pay {money(delivery.fee)}</AsyncButton>
          </section>
        )}
        {delivery.feePaid && <SuccessAlert>Delivery fee of {money(delivery.fee)} is paid.</SuccessAlert>}

        {pickedUp && (
          <section className="card p-3">
            <QRDisplay title="Delivery QR" token={delivery.deliveryToken} hint="Show this to your courier when your food arrives." />
          </section>
        )}

        <section className="card p-3">
          {pickedUp ? (
            <>
              <h2 className="h6">Need help with this delivery?</h2>
              <p className="small text-body-secondary">The courier already has your food, so a person needs to review any cancellation.</p>
              <Link className="btn btn-outline-primary btn-sm" to="/support">Contact support</Link>
            </>
          ) : (
            <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => setCancelling(true)}>Cancel delivery</button>
          )}
        </section>
      </div>
      {cancelling && <CancelDeliveryModal order={order} orders={orders} onClose={() => setCancelling(false)} />}
    </div>
  );
}

function RateCourier({ order, courier }) {
  const { run, pending, error } = useCommand(api.rateCourier);
  const { rating } = order.delivery;
  return (
    <section className="card p-3">
      <h2 className="h5">Delivered by {courier.name}</h2>
      {rating ? <p className="mb-0">You rated this delivery {rating} out of 5.</p> : (
        <>
          <p className="text-body-secondary">How was your delivery?</p>
          <div className="d-flex gap-1" role="group" aria-label="Rate your courier">
            {[1, 2, 3, 4, 5].map((value) => (
              <button key={value} type="button" className="btn btn-outline-primary btn-sm" disabled={pending} aria-label={`Rate ${value} out of 5`} onClick={() => run(order.id, value)}>
                {value} <Star size={13} aria-hidden="true" />
              </button>
            ))}
          </div>
          {error && <div className="mt-2"><ErrorAlert>{error}</ErrorAlert></div>}
        </>
      )}
    </section>
  );
}

function CourierCancelled({ order }) {
  const reopen = useCommand(api.reopenDelivery);
  const collect = useCommand(api.collectMyself);
  return (
    <section className="card p-3">
      <h2 className="h5">Your courier cancelled</h2>
      <p>Would you like to reopen this request at {money(order.delivery.fee)}, or collect the order yourself?</p>
      <div className="d-flex flex-wrap gap-2">
        <AsyncButton pending={reopen.pending} onClick={() => reopen.run(order.id)}>Reopen at {money(order.delivery.fee)}</AsyncButton>
        <AsyncButton variant="outline-secondary" pending={collect.pending} onClick={() => collect.run(order.id)}>Collect it myself</AsyncButton>
      </div>
      {(reopen.error || collect.error) && <div className="mt-3"><ErrorAlert>{reopen.error || collect.error}</ErrorAlert></div>}
    </section>
  );
}

export default function DeliveryPage() {
  const { id } = useParams();
  const { orders, outlets, users, now } = useAppState();
  const user = useCurrentUser();
  const order = orders.find((o) => o.id === id && o.customerId === user.id);
  if (!order) return <NotFound />;

  const outlet = outlets.find((o) => o.id === order.outletId);
  const outletPoint = getBuilding(outlet.buildingId);
  const { delivery } = order;
  const closed = [ORDER_STATUS.COLLECTED, ORDER_STATUS.CANCELLED].includes(order.status);
  const canRequest = !closed && (!delivery || delivery.status === DELIVERY_STATUS.CANCELLED);

  return (
    <>
      <PageHeader
        title="Delivery"
        subtitle={`Order ${orderNumber(order.id)} from ${outlet.name}`}
        backTo={`/orders/${order.id}`}
        backLabel="Order details"
        actions={delivery && <StatusBadge tone={deliveryBadge(delivery).tone}>{deliveryBadge(delivery).label}</StatusBadge>}
      />
      {canRequest && <RequestForm order={order} outletPoint={outletPoint} />}
      {!canRequest && !delivery && <ErrorAlert>This order can no longer be delivered.</ErrorAlert>}
      {delivery?.status === DELIVERY_STATUS.OPEN && <OpenRequest order={order} users={users} />}
      {[DELIVERY_STATUS.ASSIGNED, DELIVERY_STATUS.PICKED_UP].includes(delivery?.status) && (
        <ActiveDelivery order={order} outletPoint={outletPoint} users={users} now={now} orders={orders} />
      )}
      {delivery?.status === DELIVERY_STATUS.COURIER_CANCELLED && <CourierCancelled order={order} />}
      {delivery?.status === DELIVERY_STATUS.DELIVERED && <RateCourier order={order} courier={users.find((u) => u.id === delivery.courierId)} />}
      {delivery?.status === DELIVERY_STATUS.CANCELLED && closed && <ErrorAlert>This delivery was cancelled.</ErrorAlert>}
    </>
  );
}
