export const money = (amount) =>
  `EGP ${Number.isInteger(amount) ? amount : amount.toFixed(2)}`;

const dateFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });
const timeFormat = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' });

export const formatDate = (t) => dateFormat.format(t);
export const formatTime = (t) => timeFormat.format(t);
export const formatDateTime = (t) => `${formatDate(t)}, ${formatTime(t)}`;

export function timeAgo(since, now) {
  const minutes = Math.floor((now - since) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours} h ago` : formatDate(since);
}

export const initials = (name) =>
  name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('');

export const firstName = (name) => name.trim().split(/\s+/)[0];
export const orderNumber = (id) => `#${id.replace('ord-', '')}`;
