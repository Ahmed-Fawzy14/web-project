import { useState } from 'react';
import { ShoppingBag } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { CartSummary, QuantityStepper, WaitEstimate } from '../../components/orders';
import { PaymentPanel } from '../../components/PaymentPanel';
import { AsyncButton, EmptyState, ErrorAlert, Field, PageHeader, RadioCards, useCommand } from '../../components/ui';
import { money } from '../../domain/format';
import { lineKey, linesTotal, orderPrepMinutes, outletWaitMinutes, resolveLine } from '../../domain/orders';
import { phoneError } from '../../domain/validation';
import * as api from '../../store/api';
import { useAppState, useCurrentUser } from '../../store/store';

const FULFILMENT = [
  { value: 'pickup', label: 'Pick up' },
  { value: 'delivery', label: 'Delivery' },
];

export default function CheckoutPage() {
  const { cart, outlets, orders, now } = useAppState();
  const user = useCurrentUser();
  const navigate = useNavigate();
  const [fulfilment, setFulfilment] = useState('pickup');
  const [method, setMethod] = useState('card');
  const [phone, setPhone] = useState(user.phone);
  const [phoneProblem, setPhoneProblem] = useState(null);
  const { run, pending, error } = useCommand(api.placeOrder, { delay: 600 });

  if (cart.lines.length === 0) {
    return (
      <EmptyState icon={ShoppingBag} title="Your cart is empty" action={<Link className="btn btn-primary" to="/">Browse outlets</Link>}>
        Add something from a campus outlet to check out.
      </EmptyState>
    );
  }

  const outlet = outlets.find((o) => o.id === cart.outletId);
  const lines = cart.lines.map((line) => ({ raw: line, ...resolveLine(outlet, line) }));
  const unavailable = lines.filter((l) => !l.available);
  const total = linesTotal(lines);
  const wait = Math.ceil(outletWaitMinutes(outlet.id, orders, now) + orderPrepMinutes(lines));

  const submit = async (event) => {
    event.preventDefault();
    const problem = phoneError(phone);
    setPhoneProblem(problem);
    if (problem) return;
    const result = await run({ method, wantsDelivery: fulfilment === 'delivery' });
    if (result.ok) {
      api.updateProfile({ name: user.name, phone });
      navigate(fulfilment === 'delivery' ? `/orders/${result.orderId}/delivery` : `/orders/${result.orderId}`, { replace: true });
    }
  };

  return (
    <>
      <PageHeader title="Checkout" subtitle={`Your order from ${outlet.name}`} backTo={`/outlets/${outlet.id}`} backLabel={`Back to ${outlet.name}`} />
      <form className="row g-4" onSubmit={submit} noValidate>
        <div className="col-lg-7 d-grid gap-3 align-content-start">
          <section className="card p-3">
            <h2 className="h5">Your order</h2>
            <ul className="list-group list-group-flush">
              {lines.map((line) => (
                <li className="list-group-item px-0 d-flex justify-content-between align-items-center gap-2" key={lineKey(line.raw)}>
                  <div className="min-w-0">
                    <div className="fw-semibold">{line.name}</div>
                    {line.choiceSummary && <div className="small text-body-secondary">{line.choiceSummary}</div>}
                    <div className="small text-primary fw-bold">{money(line.unitPrice)}</div>
                    {!line.available && <div className="small text-danger fw-semibold">Unavailable. Remove this item to continue.</div>}
                  </div>
                  <QuantityStepper label={line.name} value={line.qty} onChange={(qty) => api.setCartQuantity(lineKey(line.raw), qty)} />
                </li>
              ))}
            </ul>
          </section>

          <section className="card p-3">
            <h2 className="h5">How would you like to get it?</h2>
            <RadioCards legend="Pickup or delivery" name="fulfilment" value={fulfilment} options={FULFILMENT} onChange={setFulfilment} />
            <p className="small text-body-secondary mb-0">
              {fulfilment === 'pickup'
                ? `Collect from ${outlet.name} at ${outlet.location} and show your QR code.`
                : 'After paying for food you join the queue right away, then set your location and offer a separate delivery fee.'}
            </p>
          </section>

          <section className="card p-3">
            <Field label="Contact phone" error={phoneProblem} className="mb-0">
              <input type="tel" autoComplete="tel" value={phone} onChange={(e) => { setPhone(e.target.value); setPhoneProblem(null); }} />
            </Field>
          </section>

          <section className="card p-3">
            <h2 className="h5">Payment</h2>
            <PaymentPanel method={method} onChange={setMethod} amount={total} />
          </section>
        </div>

        <div className="col-lg-5">
          <aside className="card p-3 sticky-lg-top checkout-summary">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <h2 className="h5 mb-0">Summary</h2>
              <WaitEstimate minutes={wait} prefix="Ready in" />
            </div>
            <CartSummary lines={lines} deliveryNote={fulfilment === 'delivery' ? 'The delivery fee is agreed and paid separately.' : null} />
            {error && <div className="mt-3"><ErrorAlert>{error}</ErrorAlert></div>}
            {unavailable.length > 0 && <div className="mt-3"><ErrorAlert>Remove unavailable items to continue.</ErrorAlert></div>}
            <AsyncButton type="submit" pending={pending} disabled={unavailable.length > 0} className="w-100 mt-3">
              Pay {money(total)} and join queue
            </AsyncButton>
          </aside>
        </div>
      </form>
    </>
  );
}
