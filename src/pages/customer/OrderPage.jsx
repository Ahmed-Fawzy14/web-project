import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  CartSummary,
  ItemCustomizer,
  OrderStatusBadge,
  OrderTimeline,
  QuantityStepper,
  QueueStatus,
} from '../../components/orders';
import { PaymentPanel, RefundChoice } from '../../components/PaymentPanel';
import { QRDisplay } from '../../components/QRHandoffPanel';
import { AsyncButton, ErrorAlert, Modal, PageHeader, StatusBadge, SuccessAlert, useCommand } from '../../components/ui';
import { formatDateTime, money, orderNumber } from '../../domain/format';
import {
  deliveryBadge,
  editLock,
  hasActiveDelivery,
  hasAssignedCourier,
  lineKey,
  linesTotal,
  ORDER_STATUS,
  resolveLine,
  roundMoney,
} from '../../domain/orders';
import * as api from '../../store/api';
import { useAppState, useCurrentUser } from '../../store/store';
import NotFound from '../shared/NotFound';

const METHOD_LABEL = { card: 'Card', apple_pay: 'Apple Pay', wallet: 'Wallet' };

function EditOrderModal({ order, outlet, onClose, onSaved }) {
  const [lines, setLines] = useState(() => order.lines.map(({ itemId, qty, choices }) => ({ itemId, qty, choices })));
  const [adding, setAdding] = useState(null);
  const [method, setMethod] = useState('card');
  const [refund, setRefund] = useState(order.payment.method === 'wallet' ? 'wallet' : 'original');
  const { run, pending, error } = useCommand(api.editOrder, { delay: 500 });

  const resolved = useMemo(() => lines.map((l) => resolveLine(outlet, l)), [lines, outlet]);
  const total = linesTotal(resolved);
  const difference = roundMoney(total - order.payment.amount);

  const setQty = (key, qty) => setLines((current) => current.map((l) => (lineKey(l) === key ? { ...l, qty } : l)).filter((l) => l.qty > 0));
  const addLine = (line) => {
    setAdding(null);
    setLines((current) => {
      const existing = current.find((l) => lineKey(l) === lineKey(line));
      return existing
        ? current.map((l) => (l === existing ? { ...l, qty: Math.min(10, l.qty + line.qty) } : l))
        : [...current, line];
    });
  };

  const save = async () => {
    const result = await run(order.id, lines, { method, refundDestination: refund });
    if (result.ok) onSaved(result.difference);
  };

  return (
    <Modal
      title={`Edit order ${orderNumber(order.id)}`}
      open
      onClose={onClose}
      footer={(
        <AsyncButton pending={pending} className="w-100" disabled={lines.length === 0} onClick={save}>
          {difference > 0 ? `Pay ${money(difference)} and save` : 'Save changes'}
        </AsyncButton>
      )}
    >
      <p className="small text-body-secondary">Your place in the queue stays the same.</p>
      <ul className="list-group list-group-flush mb-3">
        {lines.map((line, index) => (
          <li className="list-group-item px-0 d-flex justify-content-between align-items-center gap-2" key={lineKey(line)}>
            <div className="min-w-0">
              <div className="fw-semibold">{resolved[index].name}</div>
              {resolved[index].choiceSummary && <div className="small text-body-secondary">{resolved[index].choiceSummary}</div>}
              <div className="small">{money(resolved[index].unitPrice)}</div>
            </div>
            <QuantityStepper label={resolved[index].name} value={line.qty} onChange={(qty) => setQty(lineKey(line), qty)} />
          </li>
        ))}
      </ul>
      <label className="form-label fw-semibold" htmlFor="add-item">Add an item</label>
      <select
        id="add-item"
        className="form-select mb-3"
        value=""
        onChange={(e) => setAdding(outlet.menu.find((i) => i.id === e.target.value) ?? null)}
      >
        <option value="">Choose an item</option>
        {outlet.menu.filter((i) => i.available).map((item) => (
          <option key={item.id} value={item.id}>{item.name} ({money(item.price)})</option>
        ))}
      </select>
      <div className="d-flex justify-content-between fw-bold text-primary mb-3">
        <span>New total</span>
        <span>{money(total)}</span>
      </div>
      {lines.length === 0 && <div className="mb-3"><ErrorAlert>Keep at least one item, or cancel the order instead.</ErrorAlert></div>}
      {difference > 0 && <PaymentPanel name="edit-payment" method={method} onChange={setMethod} amount={difference} />}
      {difference < 0 && (
        <>
          <p className="mb-2">You will get {money(-difference)} back.</p>
          <RefundChoice name="edit-refund" value={refund} onChange={setRefund} originalMethod={order.payment.method} />
        </>
      )}
      {error && <div className="mt-3"><ErrorAlert>{error}</ErrorAlert></div>}
      {adding && <ItemCustomizer key={adding.id} item={adding} confirmLabel="Add to order" onClose={() => setAdding(null)} onConfirm={addLine} />}
    </Modal>
  );
}

function CancelOrderModal({ order, onClose }) {
  const [destination, setDestination] = useState(order.payment.method === 'wallet' ? 'wallet' : 'original');
  const { run, pending, error } = useCommand(api.cancelOrder, { delay: 500 });
  return (
    <Modal
      title={`Cancel order ${orderNumber(order.id)}?`}
      open
      onClose={onClose}
      footer={(
        <>
          <button type="button" className="btn btn-outline-secondary" onClick={onClose}>Keep order</button>
          <AsyncButton variant="danger" pending={pending} onClick={async () => { if ((await run(order.id, destination)).ok) onClose(); }}>Confirm cancellation</AsyncButton>
        </>
      )}
    >
      <p>You will be refunded {money(order.payment.amount)}.</p>
      <RefundChoice name="cancel-refund" value={destination} onChange={setDestination} originalMethod={order.payment.method} />
      {error && <ErrorAlert>{error}</ErrorAlert>}
    </Modal>
  );
}

export default function OrderPage() {
  const { id } = useParams();
  const { orders, outlets, handoffs } = useAppState();
  const user = useCurrentUser();
  const navigate = useNavigate();
  const [modal, setModal] = useState(null);
  const [saved, setSaved] = useState(null);
  const [lockMessage, setLockMessage] = useState(null);

  const order = orders.find((o) => o.id === id && o.customerId === user.id);
  if (!order) return <NotFound />;

  const outlet = outlets.find((o) => o.id === order.outletId);
  const lock = editLock(order, orders);
  const live = ![ORDER_STATUS.COLLECTED, ORDER_STATUS.CANCELLED].includes(order.status);
  const pickupToken = `PU-${order.id.replace('ord-', '')}`;
  const pickupHandoff = handoffs[pickupToken];
  const showPickupQr = live && pickupHandoff && !pickupHandoff.usedAt && !hasAssignedCourier(order);
  const canRequestDelivery = live && !hasActiveDelivery(order);

  const tryOpen = (name) => {
    setSaved(null);
    if (lock.allowed) {
      setLockMessage(null);
      setModal(name);
    } else {
      setLockMessage(lock.reason);
    }
  };

  const again = () => {
    if (api.orderAgain(order.id).ok) navigate('/checkout');
  };

  return (
    <>
      <PageHeader
        title={`Order ${orderNumber(order.id)}`}
        subtitle={`${outlet.name} · ${formatDateTime(order.placedAt)}`}
        backTo="/orders"
        backLabel="My orders"
        actions={<OrderStatusBadge order={order} />}
      />

      <div className="row g-4">
        <div className="col-lg-7 d-grid gap-3 align-content-start">
          <section className="card p-3 d-grid gap-3">
            {live && <QueueStatus order={order} />}
            <OrderTimeline order={order} />
            {order.status === ORDER_STATUS.CANCELLED && <ErrorAlert>This order was cancelled.</ErrorAlert>}
            {live && <p className="small text-body-secondary mb-0" role="status">Times are estimates and update as the outlet works through the queue.</p>}
          </section>

          {order.delivery && (
            <section className="card p-3">
              <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
                <div>
                  <h2 className="h6 mb-1">Delivery</h2>
                  <StatusBadge tone={deliveryBadge(order.delivery).tone}>{deliveryBadge(order.delivery).label}</StatusBadge>
                </div>
                <Link className="btn btn-primary btn-sm" to={`/orders/${order.id}/delivery`}>Open delivery</Link>
              </div>
            </section>
          )}

          {live && (
            <section className="card p-3">
              <h2 className="h6">Change this order</h2>
              {lock.allowed
                ? <p className="small text-body-secondary">You can edit or cancel while more than two orders are ahead and preparation has not started.</p>
                : <p className="small text-body-secondary" data-testid="lock-reason">{lock.reason}</p>}
              <div className="d-flex flex-wrap gap-2">
                <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => tryOpen('edit')}>Edit order</button>
                <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => tryOpen('cancel')}>Cancel order</button>
                {canRequestDelivery && <Link className="btn btn-outline-primary btn-sm" to={`/orders/${order.id}/delivery`}>Request delivery</Link>}
              </div>
              {lockMessage && <div className="mt-3"><ErrorAlert>{lockMessage}</ErrorAlert></div>}
              {saved !== null && <div className="mt-3"><SuccessAlert>Your order was updated and kept its place in the queue.</SuccessAlert></div>}
            </section>
          )}
        </div>

        <div className="col-lg-5 d-grid gap-3 align-content-start">
          {showPickupQr && (
            <section className="card p-3">
              <QRDisplay title="Pickup QR" token={pickupToken} hint={order.status === ORDER_STATUS.READY ? 'Show this code at the counter.' : 'You can use this code once your order is Ready.'} />
            </section>
          )}
          <section className="card p-3">
            <h2 className="h6">Items</h2>
            <CartSummary lines={order.lines} />
            {order.payment && <p className="small text-body-secondary mt-2 mb-0">Paid with {METHOD_LABEL[order.payment.method]} (simulated).</p>}
            {!live && <button type="button" className="btn btn-outline-primary btn-sm mt-3" onClick={again}>Order again</button>}
          </section>
        </div>
      </div>

      {modal === 'edit' && <EditOrderModal order={order} outlet={outlet} onClose={() => setModal(null)} onSaved={(difference) => { setModal(null); setSaved(difference); }} />}
      {modal === 'cancel' && <CancelOrderModal order={order} onClose={() => setModal(null)} />}
    </>
  );
}
