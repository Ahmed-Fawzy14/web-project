import { useState } from 'react';
import { WalletCards } from 'lucide-react';
import { WalletLedger } from '../../components/WalletLedger';
import { AsyncButton, EmptyState, ErrorAlert, Field, PageHeader, SimulatedBadge, Stat, SuccessAlert, useCommand } from '../../components/ui';
import { money } from '../../domain/format';
import { roundMoney, walletBalance } from '../../domain/orders';
import * as api from '../../store/api';
import { useAppState, useCurrentUser } from '../../store/store';

function WithdrawForm({ balance }) {
  const [amount, setAmount] = useState('');
  const [problem, setProblem] = useState(null);
  const [done, setDone] = useState(null);
  const { run, pending, error } = useCommand(api.requestWithdrawal, { delay: 500 });

  const submit = async (event) => {
    event.preventDefault();
    setDone(null);
    const value = Number(amount);
    let nextProblem = null;
    if (amount === '' || !(value > 0)) nextProblem = 'Enter an amount above zero.';
    else if (value > balance) nextProblem = 'You cannot withdraw more than your balance.';
    setProblem(nextProblem);
    if (nextProblem) return;
    const result = await run(amount);
    if (result.ok) {
      setDone(result.amount);
      setAmount('');
    }
  };

  return (
    <form className="card p-3" onSubmit={submit} noValidate>
      <div className="d-flex justify-content-between align-items-center mb-2">
        <h2 className="h5 mb-0">Request withdrawal</h2>
        <SimulatedBadge>Simulated</SimulatedBadge>
      </div>
      <Field label="Amount (EGP)" error={problem}>
        <input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </Field>
      {error && <div className="mb-3"><ErrorAlert>{error}</ErrorAlert></div>}
      {done && <div className="mb-3"><SuccessAlert>Withdrawal of {money(done)} requested.</SuccessAlert></div>}
      <AsyncButton type="submit" pending={pending}>Withdraw</AsyncButton>
    </form>
  );
}

export default function WalletPage() {
  const { transactions, session } = useAppState();
  const user = useCurrentUser();
  const mine = transactions.filter((t) => t.ownerId === user.id).sort((a, b) => b.at - a.at);
  const balance = walletBalance(transactions, user.id);
  const earnings = roundMoney(mine.filter((t) => ['earning', 'cancellation_compensation'].includes(t.type)).reduce((sum, t) => sum + t.amount, 0));
  const isCourier = session.activeRole === 'courier' && user.roles.includes('courier');

  return (
    <>
      <PageHeader title="Wallet" subtitle="Credit, refunds, payments and earnings. Balances are simulated." />
      <div className="row g-3 mb-4">
        <div className="col-sm-6 col-lg-4"><Stat label="Available balance" value={money(balance)} /></div>
        {isCourier && <div className="col-sm-6 col-lg-4"><Stat label="Total earned" value={money(earnings)} hint="After the 5% platform commission" /></div>}
      </div>
      {isCourier && <div className="mb-4"><WithdrawForm balance={balance} /></div>}
      <h2 className="h5">Transaction history</h2>
      {mine.length > 0
        ? <div className="card"><WalletLedger transactions={mine} /></div>
        : <EmptyState icon={WalletCards} title="No transactions yet">Payments and refunds will appear here.</EmptyState>}
    </>
  );
}
