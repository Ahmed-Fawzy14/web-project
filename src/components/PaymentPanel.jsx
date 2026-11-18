import { money } from '../domain/format';
import { walletBalance } from '../domain/orders';
import { useAppState, useCurrentUser } from '../store/store';
import { RadioCards, SimulatedBadge } from './ui';

/** Method picker shared by checkout, order edits and delivery fees. */
export function PaymentPanel({ name = 'payment', method, onChange, amount }) {
  const { transactions, demo } = useAppState();
  const user = useCurrentUser();
  const balance = walletBalance(transactions, user.id);
  const options = [
    { value: 'card', label: 'Card' },
    { value: 'apple_pay', label: 'Apple Pay' },
    { value: 'wallet', label: `Wallet (${money(balance)})` },
  ];

  return (
    <div>
      <RadioCards legend={`Pay ${money(amount)} with`} name={name} value={method} options={options} onChange={onChange} />
      <p className="small text-body-secondary mb-0">
        <SimulatedBadge>Simulated payment</SimulatedBadge>{' '}
        No real payment is taken. Next result: <strong>{demo.paymentOutcome === 'fail' ? 'declined' : 'approved'}</strong>, set in Demo controls.
      </p>
    </div>
  );
}

export function RefundChoice({ name = 'refund', value, onChange, originalMethod }) {
  const labels = { card: 'Original card', apple_pay: 'Apple Pay', wallet: 'Wallet' };
  const options = originalMethod === 'wallet'
    ? [{ value: 'wallet', label: 'Wallet' }]
    : [{ value: 'original', label: labels[originalMethod] }, { value: 'wallet', label: 'Wallet' }];
  return <RadioCards legend="Refund to" name={name} value={value} options={options} onChange={onChange} />;
}
