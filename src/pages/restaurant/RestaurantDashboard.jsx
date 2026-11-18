import { useState } from 'react';
import { Plus, UtensilsCrossed } from 'lucide-react';
import { OrderStatusBadge, QuantityStepper } from '../../components/orders';
import { QRScanner } from '../../components/QRHandoffPanel';
import { AsyncButton, EmptyState, ErrorAlert, Field, Modal, PageHeader, Stat, StatusBadge, useCommand } from '../../components/ui';
import { money, orderNumber, timeAgo } from '../../domain/format';
import {
  defaultChoices,
  hasAssignedCourier,
  ORDER_STATUS,
  outletQueue,
  outletWaitMinutes,
  summarizeLines,
} from '../../domain/orders';
import * as api from '../../store/api';
import { useAppState, useCurrentUser } from '../../store/store';

function QueueTicket({ order, now, position }) {
  const ready = useCommand(api.markOrderReady);
  const collect = useCommand(api.collectWalkIn);
  const walkIn = order.source === 'walk_in';
  const current = order.status === ORDER_STATUS.PREPARING;

  return (
    <article className={`card ticket ${walkIn ? 'walk-in' : ''} ${current ? 'current' : ''}`}>
      <div className="card-body d-flex flex-wrap align-items-center gap-3 py-2">
        <span className="ticket-seq" aria-label={`Sequence ${order.seq}`}>{position ?? '✓'}</span>
        <div className="flex-grow-1 min-w-0">
          <h3 className="h6 mb-1">{summarizeLines(order.lines)}</h3>
          <div className="small text-body-secondary d-flex flex-wrap gap-2 align-items-center">
            <StatusBadge tone={walkIn ? 'warning' : 'primary'}>{walkIn ? 'Walk-in' : 'App'}</StatusBadge>
            <span>{order.delivery ? 'Delivery' : walkIn ? 'In person' : 'Pickup'}</span>
            <span>{order.customerName}</span>
            <span>{orderNumber(order.id)}</span>
            <span>{timeAgo(order.placedAt, now)}</span>
          </div>
        </div>
        <div className="d-flex align-items-center gap-2 ms-auto">
          <OrderStatusBadge order={order} />
          {current && <AsyncButton className="btn-sm" pending={ready.pending} onClick={() => ready.run(order.id)}>Mark Ready</AsyncButton>}
          {order.status === ORDER_STATUS.READY && walkIn && (
            <AsyncButton className="btn-sm" variant="outline-primary" pending={collect.pending} onClick={() => collect.run(order.id)}>Mark collected</AsyncButton>
          )}
          {order.status === ORDER_STATUS.READY && !walkIn && <span className="small text-body-secondary">Scan QR to hand over</span>}
        </div>
      </div>
      {(ready.error || collect.error) && <div className="p-2"><ErrorAlert>{ready.error || collect.error}</ErrorAlert></div>}
    </article>
  );
}

function WalkInModal({ outlet, onClose }) {
  const [quantities, setQuantities] = useState({});
  const { run, pending, error } = useCommand(api.addWalkIn);
  const available = outlet.menu.filter((i) => i.available);
  const total = available.reduce((sum, i) => sum + i.price * (quantities[i.id] ?? 0), 0);

  const submit = async () => {
    const lines = available.filter((i) => quantities[i.id] > 0).map((i) => ({ itemId: i.id, qty: quantities[i.id], choices: defaultChoices(i) }));
    if ((await run(lines)).ok) onClose();
  };

  return (
    <Modal
      title="Record walk-in order"
      open
      onClose={onClose}
      footer={<AsyncButton className="w-100" pending={pending} disabled={total === 0} onClick={submit}>Add to queue · {money(total)}</AsyncButton>}
    >
      <ul className="list-group list-group-flush">
        {available.map((item) => (
          <li className="list-group-item px-0 d-flex justify-content-between align-items-center gap-2" key={item.id}>
            <span><span className="fw-semibold">{item.name}</span><span className="d-block small">{money(item.price)}</span></span>
            <QuantityStepper label={item.name} value={quantities[item.id] ?? 0} onChange={(qty) => setQuantities({ ...quantities, [item.id]: qty })} />
          </li>
        ))}
      </ul>
      {error && <div className="mt-2"><ErrorAlert>{error}</ErrorAlert></div>}
    </Modal>
  );
}

function QueueTab({ outlet }) {
  const { orders, now } = useAppState();
  const [adding, setAdding] = useState(false);
  const [filter, setFilter] = useState('all');
  const queue = outletQueue(orders, outlet.id);
  const ready = orders.filter((o) => o.outletId === outlet.id && o.status === ORDER_STATUS.READY).sort((a, b) => a.readyAt - b.readyAt);
  const matches = (o) => filter === 'all' || (filter === 'app' ? o.source === 'app' : o.source === 'walk_in');

  return (
    <>
      <div className="row g-3 mb-3">
        <div className="col-6 col-md-3"><Stat label="Current wait" value={`~${outletWaitMinutes(outlet.id, orders, now)} min`} /></div>
        <div className="col-6 col-md-3"><Stat label="In queue" value={queue.length} /></div>
        <div className="col-6 col-md-3"><Stat label="From the app" value={queue.filter((o) => o.source === 'app').length} /></div>
        <div className="col-6 col-md-3"><Stat label="Ready for handoff" value={ready.length} /></div>
      </div>
      <div className="d-flex flex-wrap justify-content-between gap-2 mb-3">
        <div className="btn-group" role="group" aria-label="Filter queue">
          {[['all', 'All'], ['app', 'App'], ['walk_in', 'Walk-in']].map(([value, label]) => (
            <button key={value} type="button" className={`btn btn-sm btn-outline-primary ${filter === value ? 'active' : ''}`} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>
          ))}
        </div>
        <button type="button" className="btn btn-primary btn-sm d-inline-flex align-items-center gap-1" onClick={() => setAdding(true)}>
          <Plus size={15} aria-hidden="true" /> Walk-in order
        </button>
      </div>

      <h2 className="h5">Order queue</h2>
      {queue.filter(matches).length === 0 && <EmptyState icon={UtensilsCrossed} title="The queue is clear">New orders will appear here.</EmptyState>}
      <div className="d-grid gap-2 mb-4" data-testid="queue-list">
        {queue.map((order, index) => matches(order) && <QueueTicket key={order.id} order={order} now={now} position={index + 1} />)}
      </div>

      {ready.filter(matches).length > 0 && (
        <>
          <h2 className="h5">Ready for handoff</h2>
          <div className="d-grid gap-2">
            {ready.filter(matches).map((order) => <QueueTicket key={order.id} order={order} now={now} />)}
          </div>
        </>
      )}
      {adding && <WalkInModal outlet={outlet} onClose={() => setAdding(false)} />}
    </>
  );
}

function MenuItemModal({ item, onClose }) {
  const [values, setValues] = useState({
    name: item?.name ?? '',
    price: item?.price ?? '',
    prepMinutes: item?.prepMinutes ?? '',
    category: item?.category ?? '',
  });
  const { run, pending, error } = useCommand(api.saveMenuItem);
  const set = (key) => (e) => setValues({ ...values, [key]: e.target.value });

  return (
    <Modal
      title={item ? `Edit ${item.name}` : 'Add menu item'}
      open
      onClose={onClose}
      footer={<AsyncButton className="w-100" pending={pending} onClick={async () => { if ((await run(item?.id, values)).ok) onClose(); }}>Save item</AsyncButton>}
    >
      <Field label="Name"><input value={values.name} onChange={set('name')} /></Field>
      <div className="row g-3">
        <div className="col-6"><Field label="Price (EGP)"><input type="number" value={values.price} onChange={set('price')} /></Field></div>
        <div className="col-6"><Field label="Prep time (min)"><input type="number" value={values.prepMinutes} onChange={set('prepMinutes')} /></Field></div>
      </div>
      <Field label="Category"><input value={values.category} onChange={set('category')} /></Field>
      {error && <ErrorAlert>{error}</ErrorAlert>}
    </Modal>
  );
}

function MenuTab({ outlet }) {
  const [editing, setEditing] = useState(undefined);
  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2 className="h5 mb-0">Menu and availability</h2>
        <button type="button" className="btn btn-primary btn-sm d-inline-flex align-items-center gap-1" onClick={() => setEditing(null)}>
          <Plus size={15} aria-hidden="true" /> Add item
        </button>
      </div>
      <div className="card">
        <div className="table-responsive">
          <table className="table align-middle mb-0">
            <caption className="visually-hidden">Menu items</caption>
            <thead><tr><th scope="col">Item</th><th scope="col">Price</th><th scope="col">Prep</th><th scope="col">Available</th><th scope="col"><span className="visually-hidden">Actions</span></th></tr></thead>
            <tbody>
              {outlet.menu.map((item) => (
                <tr key={item.id}>
                  <td className="fw-semibold">{item.name}</td>
                  <td className="text-nowrap">{money(item.price)}</td>
                  <td className="text-nowrap">{item.prepMinutes} min</td>
                  <td>
                    <div className="form-check form-switch mb-0">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        role="switch"
                        aria-label={`${item.name} available`}
                        checked={item.available}
                        onChange={(e) => api.setItemAvailability(item.id, e.target.checked)}
                      />
                    </div>
                  </td>
                  <td><button type="button" className="btn btn-sm btn-outline-primary" aria-label={`Edit ${item.name}`} onClick={() => setEditing(item)}>Edit</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {editing !== undefined && <MenuItemModal item={editing} onClose={() => setEditing(undefined)} />}
    </>
  );
}

function HandoffTab({ outlet }) {
  const { orders } = useAppState();
  const ready = orders.filter((o) => o.outletId === outlet.id && o.status === ORDER_STATUS.READY && o.source === 'app');
  const tokens = ready.flatMap((o) => (hasAssignedCourier(o)
    ? [o.delivery.pickupToken, o.delivery.deliveryToken]
    : [`PU-${o.id.replace('ord-', '')}`]));

  return (
    <div className="row justify-content-center">
      <div className="col-md-8 col-lg-6">
        <div className="card p-3">
          <QRScanner title="Scan customer or courier QR" onScan={api.scanAtOutlet} testTokens={tokens} />
        </div>
      </div>
    </div>
  );
}

const TABS = [['queue', 'Queue'], ['menu', 'Menu'], ['handoff', 'QR handoff']];

export default function RestaurantDashboard() {
  const { outlets } = useAppState();
  const user = useCurrentUser();
  const [tab, setTab] = useState('queue');
  const outlet = outlets.find((o) => o.id === user.outletId);

  return (
    <>
      <PageHeader title={outlet.name} subtitle="One first-in, first-out queue for app and walk-in orders." />
      <ul className="nav nav-tabs mb-4" role="tablist">
        {TABS.map(([id, label]) => (
          <li className="nav-item" role="presentation" key={id}>
            <button type="button" role="tab" aria-selected={tab === id} className={`nav-link ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>{label}</button>
          </li>
        ))}
      </ul>
      {tab === 'queue' && <QueueTab outlet={outlet} />}
      {tab === 'menu' && <MenuTab outlet={outlet} />}
      {tab === 'handoff' && <HandoffTab outlet={outlet} />}
    </>
  );
}
