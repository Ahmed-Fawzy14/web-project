import { useState } from 'react';
import { BadgeCheck, LifeBuoy } from 'lucide-react';
import { AsyncButton, EmptyState, ErrorAlert, Field, PageHeader, RadioCards, SimulatedBadge, StatusBadge, useCommand } from '../../components/ui';
import { formatDateTime, money, orderNumber, timeAgo } from '../../domain/format';
import { summarizeLines } from '../../domain/orders';
import * as api from '../../store/api';
import { useAppState } from '../../store/store';

function ApplicationCard({ applicant, kind, now }) {
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState(null);
  const { run, pending, error } = useCommand(api.reviewApplication);

  const reject = async () => {
    if (!reason.trim()) {
      setReasonError('Add a reason so the applicant knows what to fix.');
      return;
    }
    setReasonError(null);
    await run(applicant.id, kind, 'rejected', reason);
  };

  return (
    <article className="card" data-testid={`application-${applicant.id}`}>
      <div className="card-body">
        <div className="d-flex flex-wrap justify-content-between gap-2 mb-2">
          <div>
            <h3 className="h6 mb-0">{applicant.name}</h3>
            <div className="small text-body-secondary">{applicant.email} · {applicant.phone}</div>
          </div>
          <StatusBadge tone={kind === 'courier' ? 'primary' : 'secondary'}>{kind === 'courier' ? 'Courier' : 'Customer'}</StatusBadge>
        </div>
        <p className="small mb-2">
          Affiliation: <span className="text-capitalize">{applicant.affiliation}</span> · ID file: <strong>{applicant.verification.idFileName}</strong>
          {applicant.appliedAt && ` · ${timeAgo(applicant.appliedAt, now)}`}
        </p>
        <Field label="Reason if rejecting" error={reasonError}>
          <input value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        {error && <div className="mb-2"><ErrorAlert>{error}</ErrorAlert></div>}
        <div className="d-flex gap-2">
          <AsyncButton variant="outline-danger" pending={pending} onClick={reject}>Reject</AsyncButton>
          <AsyncButton pending={pending} onClick={() => run(applicant.id, kind, 'approved')}>Approve</AsyncButton>
        </div>
      </div>
    </article>
  );
}

function IdReviewTab() {
  const { users, now } = useAppState();
  const applications = users.flatMap((u) => ['customer', 'courier']
    .filter((kind) => u.verification[kind] === 'pending')
    .map((kind) => ({ applicant: u, kind })));

  if (applications.length === 0) {
    return <EmptyState icon={BadgeCheck} title="No applications waiting">New ID submissions will appear here.</EmptyState>;
  }
  return (
    <div className="row g-3">
      {applications.map(({ applicant, kind }) => (
        <div className="col-lg-6" key={`${applicant.id}-${kind}`}><ApplicationCard applicant={applicant} kind={kind} now={now} /></div>
      ))}
    </div>
  );
}

const OUTCOMES = [
  { value: 'no_action', label: 'No refund' },
  { value: 'refund', label: 'Refund to wallet' },
];

function CaseCard({ supportCase }) {
  const { orders, transactions } = useAppState();
  const [outcome, setOutcome] = useState('no_action');
  const [note, setNote] = useState('');
  const [amount, setAmount] = useState('');
  const { run, pending, error } = useCommand(api.resolveSupportCase);
  const order = orders.find((o) => o.id === supportCase.orderId);
  const payments = transactions.filter((t) => t.orderId && t.orderId === supportCase.orderId);
  const resolved = supportCase.status === 'resolved';

  return (
    <article className="card" data-testid="support-case">
      <div className="card-body">
        <div className="d-flex flex-wrap justify-content-between gap-2">
          <h3 className="h6 mb-0">{supportCase.userName}</h3>
          <StatusBadge tone={resolved ? 'success' : 'warning'}>{resolved ? 'Resolved' : 'Escalated'}</StatusBadge>
        </div>
        <p className="small text-body-secondary">{supportCase.reason} · {formatDateTime(supportCase.createdAt)}</p>

        {supportCase.transcript.length > 0 && (
          <details className="mb-2">
            <summary className="fw-semibold small">Conversation ({supportCase.transcript.length})</summary>
            <ul className="list-unstyled small mt-2 mb-0">
              {supportCase.transcript.map((line, index) => (
                <li key={index} dir="auto"><strong className="text-capitalize">{line.from}:</strong> {line.text}</li>
              ))}
            </ul>
          </details>
        )}
        {order && (
          <details className="mb-3">
            <summary className="fw-semibold small">Order {orderNumber(order.id)} and payments</summary>
            <p className="small mt-2 mb-1">{summarizeLines(order.lines)}</p>
            {payments.length === 0 && <p className="small text-body-secondary mb-0">No payments recorded.</p>}
            <ul className="list-unstyled small mb-0">
              {payments.map((tx) => <li key={tx.id}>{tx.note}: {money(tx.amount)}</li>)}
            </ul>
          </details>
        )}

        {resolved ? (
          <p className="small mb-0"><strong>Resolution:</strong> {supportCase.resolution.note}{supportCase.resolution.amount > 0 && ` (${money(supportCase.resolution.amount)} refunded)`}</p>
        ) : (
          <>
            <RadioCards legend="Outcome" name={`outcome-${supportCase.id}`} value={outcome} options={OUTCOMES} onChange={setOutcome} />
            {outcome === 'refund' && (
              <Field label="Refund amount (EGP)"><input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
            )}
            <Field label="Resolution note"><textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
            {error && <div className="mb-2"><ErrorAlert>{error}</ErrorAlert></div>}
            <AsyncButton pending={pending} onClick={() => run(supportCase.id, { outcome, note, refundAmount: amount })}>Resolve case</AsyncButton>
          </>
        )}
      </div>
    </article>
  );
}

function SupportTab() {
  const { supportCases } = useAppState();
  if (supportCases.length === 0) {
    return <EmptyState icon={LifeBuoy} title="No escalated cases">Requests for a person will appear here.</EmptyState>;
  }
  return (
    <div className="row g-3">
      {supportCases.map((c) => <div className="col-lg-6" key={c.id}><CaseCard supportCase={c} /></div>)}
    </div>
  );
}

const TABS = [['ids', 'ID review'], ['support', 'Support escalations']];

export default function AdminDashboard() {
  const [tab, setTab] = useState('ids');
  return (
    <>
      <PageHeader title="Admin dashboard" subtitle="Review IDs and resolve escalated support cases." actions={<SimulatedBadge>Simulated verification</SimulatedBadge>} />
      <ul className="nav nav-tabs mb-4" role="tablist">
        {TABS.map(([id, label]) => (
          <li className="nav-item" role="presentation" key={id}>
            <button type="button" role="tab" aria-selected={tab === id} className={`nav-link ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>{label}</button>
          </li>
        ))}
      </ul>
      {tab === 'ids' ? <IdReviewTab /> : <SupportTab />}
    </>
  );
}
