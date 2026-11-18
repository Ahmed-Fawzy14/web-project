import { useRef, useState } from 'react';
import { Bot, Mic, Send, UserRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { interpret } from '../assistant/interpret';
import { money, orderNumber } from '../domain/format';
import * as api from '../store/api';
import { useAppState, useCurrentUser } from '../store/store';
import { AsyncButton, ErrorAlert, SimulatedBadge, useCommand } from './ui';
import { CartSummary } from './orders';
import { PaymentPanel } from './PaymentPanel';

const VOICE_SAMPLES = [
  { label: 'English', text: '2 iced lattes and a croissant from Outlet A' },
  { label: 'Egyptian Arabic', text: 'عايز ٢ لاتيه مثلج وكرواسون من منفذ أ' },
];

const WELCOME = {
  id: 'welcome',
  from: 'assistant',
  text: 'Hi! Ask about your order, our policies, or type what you would like to eat. You can write in English or Egyptian Arabic.',
};

export function SupportAssistant() {
  const state = useAppState();
  const user = useCurrentUser();
  const [messages, setMessages] = useState([WELCOME]);
  const [input, setInput] = useState('');
  const [pendingText, setPendingText] = useState(null);
  const [action, setAction] = useState(null);
  const [method, setMethod] = useState('card');
  const [micError, setMicError] = useState(null);
  const nextId = useRef(1);

  const placeDraft = useCommand(api.placeAssistantOrder);
  const cancelOrder = useCommand(api.cancelOrder);

  const say = (from, text, extra = {}) => {
    nextId.current += 1;
    const message = { id: nextId.current, from, text, ...extra };
    setMessages((current) => [...current, message]);
    return message;
  };

  const transcriptWith = (...extra) =>
    [...messages, ...extra].filter((m) => m.id !== 'welcome').map(({ from, text }) => ({ from, text }));

  const send = (text, viaVoice = false) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const userMessage = say('user', trimmed, { viaVoice });
    setInput('');
    setAction(null);

    const reply = interpret(trimmed, { state, user, pendingText });
    setPendingText(reply.kind === 'clarify' ? reply.pendingText : null);
    const assistantMessage = say('assistant', reply.text, { link: reply.link });

    if (reply.kind === 'draft') setAction({ type: 'draft', draft: reply.draft });
    if (reply.kind === 'confirm_cancel') setAction({ type: 'cancel', orderId: reply.orderId });
    if (reply.kind === 'escalate') {
      api.escalateToHuman({ reason: reply.reason, transcript: transcriptWith(userMessage, assistantMessage) });
    }
  };

  const requestPerson = () => send('I want to talk to a person');

  const voice = (sample) => {
    if (state.demo.microphone === 'denied') {
      setMicError('Microphone access is unavailable. Type your request instead.');
      return;
    }
    setMicError(null);
    send(sample.text, true);
  };

  const confirmDraft = async () => {
    const result = await placeDraft.run(action.draft, method);
    if (result.ok) {
      setAction(null);
      say('assistant', `Order ${orderNumber(result.orderId)} is placed and in the queue.`, { link: { to: `/orders/${result.orderId}`, label: 'Track this order' } });
    }
  };

  const confirmCancel = async () => {
    const result = await cancelOrder.run(action.orderId, 'original');
    if (result.ok) {
      setAction(null);
      say('assistant', `Order ${orderNumber(action.orderId)} is cancelled and your refund is recorded.`);
    }
  };

  const discard = () => {
    setAction(null);
    say('assistant', 'Discarded. Nothing was placed or changed.');
  };

  return (
    <div className="card">
      <div className="card-header d-flex flex-wrap justify-content-between align-items-center gap-2 bg-white">
        <span className="fw-bold d-inline-flex align-items-center gap-2"><Bot size={18} aria-hidden="true" /> OtlobAUC assistant</span>
        <SimulatedBadge>Simulated AI and voice</SimulatedBadge>
      </div>

      <div className="chat-log" role="log" aria-live="polite" aria-label="Conversation">
        {messages.map((message) => (
          <div key={message.id} className={`chat-row ${message.from}`}>
            <div className="chat-bubble" dir="auto">
              {message.viaVoice && <span className="d-block small opacity-75"><Mic size={12} aria-hidden="true" /> Voice transcript (simulated)</span>}
              {message.text}
              {message.link && <div className="mt-1"><Link to={message.link.to}>{message.link.label}</Link></div>}
            </div>
          </div>
        ))}

        {action?.type === 'draft' && (
          <div className="card draft-card" data-testid="draft-card">
            <div className="card-body">
              <h3 className="h6">{action.draft.outletName}</h3>
              <CartSummary lines={action.draft.resolved} />
              <p className="small text-body-secondary mt-2">Estimated wait ~{action.draft.waitMinutes} min</p>
              <PaymentPanel name="assistant-payment" method={method} onChange={setMethod} amount={action.draft.total} />
              {placeDraft.error && <div className="mt-2"><ErrorAlert>{placeDraft.error}</ErrorAlert></div>}
              <div className="d-flex gap-2 mt-3">
                <button type="button" className="btn btn-outline-secondary flex-fill" onClick={discard}>Discard</button>
                <AsyncButton className="flex-fill" pending={placeDraft.pending} onClick={confirmDraft}>Confirm · {money(action.draft.total)}</AsyncButton>
              </div>
            </div>
          </div>
        )}

        {action?.type === 'cancel' && (
          <div className="card draft-card">
            <div className="card-body">
              {cancelOrder.error && <div className="mb-2"><ErrorAlert>{cancelOrder.error}</ErrorAlert></div>}
              <div className="d-flex gap-2">
                <button type="button" className="btn btn-outline-secondary flex-fill" onClick={discard}>Keep order</button>
                <AsyncButton variant="danger" className="flex-fill" pending={cancelOrder.pending} onClick={confirmCancel}>Confirm cancellation</AsyncButton>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="card-footer bg-white">
        {micError && <div className="mb-2"><ErrorAlert>{micError}</ErrorAlert></div>}
        <div className="d-flex flex-wrap gap-2 align-items-center mb-2">
          <span className="small text-body-secondary">Try voice:</span>
          {VOICE_SAMPLES.map((sample) => (
            <button key={sample.label} type="button" className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1" onClick={() => voice(sample)}>
              <Mic size={13} aria-hidden="true" /> {sample.label}
            </button>
          ))}
          <button type="button" className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1 ms-md-auto" onClick={requestPerson}>
            <UserRound size={13} aria-hidden="true" /> Talk to a person
          </button>
        </div>
        <form className="input-group" onSubmit={(e) => { e.preventDefault(); send(input); }}>
          <label className="visually-hidden" htmlFor="assistant-input">Message the assistant</label>
          <input id="assistant-input" className="form-control" dir="auto" value={input} placeholder="Type a message" onChange={(e) => setInput(e.target.value)} />
          <button type="submit" className="btn btn-primary" aria-label="Send message"><Send size={17} aria-hidden="true" /></button>
        </form>
      </div>
    </div>
  );
}
