import { SupportAssistant } from '../../components/SupportAssistant';
import { PageHeader, StatusBadge } from '../../components/ui';
import { formatDateTime } from '../../domain/format';
import { useAppState, useCurrentUser } from '../../store/store';

export default function SupportPage() {
  const { supportCases } = useAppState();
  const user = useCurrentUser();
  const mine = supportCases.filter((c) => c.userId === user.id);

  return (
    <>
      <PageHeader title="Support" subtitle="Ask a question, order by chat or voice, or reach a person." />
      <SupportAssistant />
      {mine.length > 0 && (
        <section className="mt-4">
          <h2 className="h5">Your support cases</h2>
          <ul className="list-group">
            {mine.map((c) => (
              <li className="list-group-item" key={c.id}>
                <div className="d-flex justify-content-between gap-2">
                  <span className="fw-semibold">{c.reason}</span>
                  <StatusBadge tone={c.status === 'open' ? 'warning' : 'success'}>{c.status === 'open' ? 'With the team' : 'Resolved'}</StatusBadge>
                </div>
                <div className="small text-body-secondary">{formatDateTime(c.createdAt)}</div>
                {c.resolution && <div className="small mt-1">Resolution: {c.resolution.note}</div>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
