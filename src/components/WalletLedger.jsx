import { formatDateTime, money } from '../domain/format';

const TYPE_LABEL = {
  payment: 'Payment',
  refund: 'Refund',
  credit: 'Credit',
  earning: 'Earning',
  commission: 'Commission',
  withdrawal: 'Withdrawal',
  cancellation_compensation: 'Cancellation compensation',
};
const METHOD_LABEL = { card: 'Card', apple_pay: 'Apple Pay', wallet: 'Wallet', bank: 'Bank transfer' };

export function WalletLedger({ transactions }) {
  return (
    <div className="table-responsive">
      <table className="table align-middle mb-0">
        <caption className="visually-hidden">Wallet transaction history</caption>
        <thead>
          <tr>
            <th scope="col">Type</th>
            <th scope="col">Details</th>
            <th scope="col">Method</th>
            <th scope="col">Date</th>
            <th scope="col" className="text-end">Amount</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((tx) => (
            <tr key={tx.id}>
              <td className="fw-semibold text-nowrap">{TYPE_LABEL[tx.type]}</td>
              <td className="small">{tx.note}</td>
              <td className="small text-nowrap">{METHOD_LABEL[tx.method]}</td>
              <td className="small text-nowrap">{formatDateTime(tx.at)}</td>
              <td className={`text-end text-nowrap fw-bold ${tx.walletDelta > 0 ? 'text-success' : ''}`}>
                {tx.walletDelta > 0 ? '+' : tx.walletDelta < 0 ? '−' : ''}{money(tx.amount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
