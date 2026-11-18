import { useState } from 'react';
import { Check, Clock, Minus, Phone, Plus, ShieldCheck, Star, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { money, orderNumber } from '../domain/format';
import {
  defaultChoices,
  DELIVERY_STATUS,
  estimateMinutes,
  isNewCourier,
  linesTotal,
  MAX_QUANTITY,
  ORDER_STATUS,
  orderBadge,
  ordersAhead,
  outletQueue,
  outletWaitMinutes,
} from '../domain/orders';
import { useAppState } from '../store/store';
import { Modal, SimulatedBadge, StatusBadge } from './ui';

export function OrderStatusBadge({ order }) {
  const { label, tone } = orderBadge(order);
  return <StatusBadge tone={tone}>{label}</StatusBadge>;
}

export function WaitEstimate({ minutes, prefix = 'Est. wait' }) {
  const tone = minutes <= 10 ? 'success' : minutes <= 20 ? 'warning' : 'danger';
  return (
    <span className={`badge rounded-pill text-bg-${tone} d-inline-flex align-items-center gap-1`}>
      <Clock size={12} aria-hidden="true" /> {prefix} ~{minutes} min
    </span>
  );
}

export function OutletCard({ outlet }) {
  const { orders, now } = useAppState();
  const queueLength = outletQueue(orders, outlet.id).length;
  return (
    <Link to={`/outlets/${outlet.id}`} className="card outlet-card h-100 text-decoration-none">
      <div className="outlet-banner" aria-hidden="true">{outlet.emoji}</div>
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-start gap-2">
          <h2 className="h5 mb-0">{outlet.name}</h2>
          <span className="small text-body-secondary text-nowrap">{outlet.code}</span>
        </div>
        <p className="small text-body-secondary mb-2">{outlet.cuisine} · {outlet.location}</p>
        {outlet.open ? (
          <div className="d-flex flex-wrap gap-2 align-items-center">
            <WaitEstimate minutes={outletWaitMinutes(outlet.id, orders, now)} />
            <span className="small text-body-secondary d-inline-flex align-items-center gap-1">
              <Users size={13} aria-hidden="true" /> {queueLength} in queue
            </span>
          </div>
        ) : (
          <StatusBadge tone="secondary">Closed · {outlet.hours}</StatusBadge>
        )}
      </div>
    </Link>
  );
}

export function QuantityStepper({ label, value, onChange, min = 0 }) {
  return (
    <div className="input-group input-group-sm stepper" role="group" aria-label={`Quantity of ${label}`}>
      <button type="button" className="btn btn-outline-primary" aria-label={`Remove one ${label}`} disabled={value <= min} onClick={() => onChange(value - 1)}>
        <Minus size={14} aria-hidden="true" />
      </button>
      <span className="input-group-text bg-white fw-bold" aria-live="polite">{value}</span>
      <button type="button" className="btn btn-outline-primary" aria-label={`Add one ${label}`} disabled={value >= MAX_QUANTITY} onClick={() => onChange(value + 1)}>
        <Plus size={14} aria-hidden="true" />
      </button>
    </div>
  );
}

export function MenuItemCard({ item, disabled, onAdd }) {
  return (
    <article className={`card h-100 ${item.available ? '' : 'opacity-75'}`}>
      <div className="card-body d-flex gap-3 align-items-center">
        <span className="item-thumb" aria-hidden="true">{item.emoji}</span>
        <div className="flex-grow-1 min-w-0">
          <h3 className="h6 mb-0">{item.name}</h3>
          {item.description && <p className="small text-body-secondary mb-1">{item.description}</p>}
          <div className="fw-bold text-primary">{money(item.price)}</div>
          <div className="small text-body-secondary">About {item.prepMinutes} min to prepare</div>
        </div>
        {item.available ? (
          <button type="button" className="btn btn-sm btn-outline-primary" disabled={disabled} onClick={() => onAdd(item)} aria-label={`Add ${item.name}`}>
            Add
          </button>
        ) : (
          <StatusBadge tone="secondary">Unavailable</StatusBadge>
        )}
      </div>
    </article>
  );
}

/** Chooses quantity and customizations before an item is added to an order. */
export function ItemCustomizer({ item, onClose, onConfirm, confirmLabel = 'Add to cart' }) {
  const [qty, setQty] = useState(1);
  const [choices, setChoices] = useState(() => defaultChoices(item));
  const extra = (item.options ?? []).reduce(
    (sum, group) => sum + (group.choices.find((c) => c.id === choices[group.id])?.priceDelta ?? 0),
    0,
  );

  return (
    <Modal
      title={item.name}
      open
      onClose={onClose}
      footer={(
        <button type="button" className="btn btn-primary w-100" onClick={() => onConfirm({ itemId: item.id, qty, choices })}>
          {confirmLabel} · {money((item.price + extra) * qty)}
        </button>
      )}
    >
      {(item.options ?? []).map((group) => (
        <fieldset className="mb-3" key={group.id}>
          <legend className="form-label fw-semibold fs-6">{group.name}</legend>
          {group.choices.map((choice) => (
            <div className="form-check" key={choice.id}>
              <input
                className="form-check-input"
                type="radio"
                id={`${group.id}-${choice.id}`}
                name={group.id}
                checked={choices[group.id] === choice.id}
                onChange={() => setChoices({ ...choices, [group.id]: choice.id })}
              />
              <label className="form-check-label" htmlFor={`${group.id}-${choice.id}`}>
                {choice.name}{choice.priceDelta > 0 && ` (+${money(choice.priceDelta)})`}
              </label>
            </div>
          ))}
        </fieldset>
      ))}
      <div className="d-flex justify-content-between align-items-center">
        <span className="fw-semibold">Quantity</span>
        <QuantityStepper label={item.name} value={qty} min={1} onChange={setQty} />
      </div>
    </Modal>
  );
}

export function CartSummary({ lines, deliveryNote }) {
  return (
    <dl className="mb-0">
      {lines.map((line, index) => (
        <div className="d-flex justify-content-between gap-3 mb-1" key={`${line.itemId}-${index}`}>
          <dt className="fw-normal">
            {line.qty}× {line.name}
            {line.choiceSummary && <span className="d-block small text-body-secondary">{line.choiceSummary}</span>}
          </dt>
          <dd className="mb-0 text-nowrap">{money(line.unitPrice * line.qty)}</dd>
        </div>
      ))}
      <div className="d-flex justify-content-between border-top pt-2 mt-2 fw-bold text-primary">
        <dt>Food total</dt>
        <dd className="mb-0">{money(linesTotal(lines))}</dd>
      </div>
      {deliveryNote && <p className="small text-body-secondary mt-2 mb-0">{deliveryNote}</p>}
    </dl>
  );
}

/** FR-03: position, remaining estimate and status, kept live by the store. */
export function QueueStatus({ order }) {
  const { orders, now } = useAppState();
  const ahead = ordersAhead(order, orders).length;
  const minutes = estimateMinutes(order, orders, now);
  const inKitchen = [ORDER_STATUS.QUEUED, ORDER_STATUS.PREPARING].includes(order.status);

  return (
    <div className="row g-2 text-center">
      <div className="col-4">
        <div className="queue-stat">
          <span className="queue-stat-value" data-testid="queue-position">{inKitchen ? ahead + 1 : '–'}</span>
          <span className="small text-body-secondary">Queue position</span>
        </div>
      </div>
      <div className="col-4">
        <div className="queue-stat">
          <span className="queue-stat-value" data-testid="orders-ahead">{inKitchen ? ahead : 0}</span>
          <span className="small text-body-secondary">Orders ahead</span>
        </div>
      </div>
      <div className="col-4">
        <div className="queue-stat">
          <span className="queue-stat-value" data-testid="order-estimate">{inKitchen ? `~${minutes}` : '0'}</span>
          <span className="small text-body-secondary">Est. minutes</span>
        </div>
      </div>
    </div>
  );
}

function timelineSteps(order) {
  const { delivery } = order;
  const delivering = delivery && [DELIVERY_STATUS.ASSIGNED, DELIVERY_STATUS.PICKED_UP, DELIVERY_STATUS.DELIVERED].includes(delivery.status);
  const labels = delivering
    ? ['In queue', 'Preparing', 'Ready', 'With courier', 'Delivered']
    : ['In queue', 'Preparing', 'Ready', 'Collected'];
  let current = { queued: 0, preparing: 1, ready: 2, collected: 3 }[order.status] ?? 0;
  if (delivering && delivery.status === DELIVERY_STATUS.DELIVERED) current = 5;
  else if (!delivering && order.status === ORDER_STATUS.COLLECTED) current = 4;
  return { labels, current };
}

export function OrderTimeline({ order }) {
  const { labels, current } = timelineSteps(order);
  return (
    <ol className="timeline" style={{ '--steps': labels.length }}>
      {labels.map((label, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <li key={label} className={`timeline-step ${done ? 'done' : ''} ${active ? 'active' : ''}`} aria-current={active ? 'step' : undefined}>
            <span className="timeline-dot">{done ? <Check size={15} aria-hidden="true" /> : index + 1}</span>
            <span className="timeline-label">{label}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function Reliability({ courier }) {
  const stats = courier.courierStats;
  if (isNewCourier(stats)) return <StatusBadge tone="info">New courier</StatusBadge>;
  return (
    <span className="small text-body-secondary d-inline-flex flex-wrap gap-2 align-items-center">
      <span className="d-inline-flex align-items-center gap-1"><Star size={13} className="text-gold" aria-hidden="true" /> {stats.rating?.toFixed(1) ?? 'No ratings'}</span>
      <span className="d-inline-flex align-items-center gap-1"><ShieldCheck size={13} aria-hidden="true" /> {stats.completionRate}% completed</span>
      <span>{stats.completed} deliveries</span>
      <span>{stats.cancellations} cancelled</span>
      <span>{stats.missedPickups} missed</span>
    </span>
  );
}

export function DeliveryBidCard({ bid, courier, pending, onAccept, onDecline }) {
  return (
    <article className="card">
      <div className="card-body d-flex flex-wrap justify-content-between gap-2 align-items-center">
        <div>
          <h3 className="h6 mb-1">{courier.name}</h3>
          <Reliability courier={courier} />
        </div>
        <div className="d-flex align-items-center gap-2">
          <strong className="text-primary">{money(bid.amount)}</strong>
          <button type="button" className="btn btn-sm btn-outline-secondary" disabled={pending} onClick={onDecline}>Decline</button>
          <button type="button" className="btn btn-sm btn-primary" disabled={pending} onClick={onAccept}>Accept</button>
        </div>
      </div>
    </article>
  );
}

export function CallButton({ phone, label }) {
  return (
    <a className="btn btn-outline-primary btn-sm d-inline-flex align-items-center gap-1" href={`tel:${phone}`}>
      <Phone size={14} aria-hidden="true" /> {label}
    </a>
  );
}

export function OrderListCard({ order, outlet, actions }) {
  return (
    <article className="card h-100">
      <div className="card-body">
        <div className="d-flex justify-content-between gap-2 mb-1">
          <h3 className="h6 mb-0">{outlet.name}</h3>
          <OrderStatusBadge order={order} />
        </div>
        <p className="small text-body-secondary mb-2">{orderNumber(order.id)} · {order.lines.map((l) => `${l.qty}× ${l.name}`).join(', ')}</p>
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
          <strong className="text-primary">{money(linesTotal(order.lines))}</strong>
          <div className="d-flex gap-2">{actions}</div>
        </div>
      </div>
    </article>
  );
}

export { SimulatedBadge };
