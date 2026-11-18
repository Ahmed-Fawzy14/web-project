import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { ItemCustomizer, MenuItemCard, WaitEstimate } from '../../components/orders';
import { ErrorAlert, Modal, PageHeader, StatusBadge } from '../../components/ui';
import { money } from '../../domain/format';
import { itemCount, linesTotal, outletQueue, outletWaitMinutes, resolveLine } from '../../domain/orders';
import * as api from '../../store/api';
import { useAppState } from '../../store/store';
import NotFound from '../shared/NotFound';

export default function OutletPage() {
  const { id } = useParams();
  const { outlets, orders, cart, now } = useAppState();
  const [customizing, setCustomizing] = useState(null);
  const [conflict, setConflict] = useState(null);
  const [error, setError] = useState(null);

  const outlet = outlets.find((o) => o.id === id);
  if (!outlet) return <NotFound />;

  const cartHere = cart.outletId === outlet.id;
  const otherOutlet = cart.outletId && !cartHere ? outlets.find((o) => o.id === cart.outletId) : null;
  const categories = [...new Set(outlet.menu.map((i) => i.category))];
  const cartLines = cartHere ? cart.lines.map((l) => resolveLine(outlet, l)) : [];

  const add = (line) => {
    const result = api.addToCart(outlet.id, line);
    setError(result.ok ? null : result.error);
    setCustomizing(null);
    setConflict(null);
  };

  const confirm = (line) => {
    if (otherOutlet) {
      setCustomizing(null);
      setConflict(line);
    } else {
      add(line);
    }
  };

  return (
    <>
      <PageHeader
        title={outlet.name}
        subtitle={`${outlet.code} · ${outlet.cuisine} · ${outlet.location} · ${outlet.hours}`}
        backTo="/"
        backLabel="All outlets"
        actions={outlet.open
          ? <span className="d-flex gap-2 align-items-center"><WaitEstimate minutes={outletWaitMinutes(outlet.id, orders, now)} /><span className="small text-body-secondary">{outletQueue(orders, outlet.id).length} in queue</span></span>
          : <StatusBadge>Closed</StatusBadge>}
      />
      {error && <div className="mb-3"><ErrorAlert>{error}</ErrorAlert></div>}

      {categories.map((category) => (
        <section className="mb-4" key={category}>
          <h2 className="h5">{category}</h2>
          <div className="row g-3">
            {outlet.menu.filter((i) => i.category === category).map((item) => (
              <div className="col-md-6" key={item.id}>
                <MenuItemCard item={item} disabled={!outlet.open} onAdd={setCustomizing} />
              </div>
            ))}
          </div>
        </section>
      ))}

      {cartLines.length > 0 && (
        <div className="cart-bar">
          <Link to="/checkout" className="btn btn-primary btn-lg w-100 d-flex justify-content-between align-items-center shadow">
            <span className="fs-6">{itemCount(cartLines)} {itemCount(cartLines) === 1 ? 'item' : 'items'} · {money(linesTotal(cartLines))}</span>
            <span className="fs-6 d-inline-flex align-items-center gap-1">Checkout <ArrowRight size={18} aria-hidden="true" /></span>
          </Link>
        </div>
      )}

      {customizing && <ItemCustomizer key={customizing.id} item={customizing} onClose={() => setCustomizing(null)} onConfirm={confirm} />}

      <Modal
        title="Start a new order?"
        open={Boolean(conflict)}
        onClose={() => setConflict(null)}
        footer={(
          <>
            <button type="button" className="btn btn-outline-secondary" onClick={() => setConflict(null)}>Keep current cart</button>
            <button type="button" className="btn btn-primary" onClick={() => add(conflict)}>Start new order</button>
          </>
        )}
      >
        <p className="mb-0">Your cart has items from {otherOutlet?.name}. Each order comes from one outlet, so adding this clears them.</p>
      </Modal>
    </>
  );
}
