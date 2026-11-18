export const ORDER_STATUS = {
  QUEUED: 'queued',
  PREPARING: 'preparing',
  READY: 'ready',
  COLLECTED: 'collected',
  CANCELLED: 'cancelled',
};

export const DELIVERY_STATUS = {
  OPEN: 'open',
  ASSIGNED: 'assigned',
  PICKED_UP: 'picked_up',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
  COURIER_CANCELLED: 'courier_cancelled',
};

export const MAX_QUANTITY = 10;
export const COURIER_SHARE = 0.95;

const MINUTE = 60_000;
export const roundMoney = (amount) => Math.round(amount * 100) / 100;

export const courierEarning = (fee) => roundMoney(fee * COURIER_SHARE);
export const platformCommission = (fee) => roundMoney(fee - courierEarning(fee));

export const defaultChoices = (item) =>
  Object.fromEntries((item.options ?? []).map((group) => [group.id, group.choices[0].id]));

export const lineKey = ({ itemId, choices = {} }) =>
  `${itemId}|${Object.keys(choices).sort().map((k) => `${k}:${choices[k]}`).join(',')}`;

/** Turns a cart line into a priced snapshot, so later menu edits never rewrite an order. */
export function resolveLine(outlet, line) {
  const item = outlet.menu.find((i) => i.id === line.itemId);
  if (!item) return null;
  const selected = (item.options ?? []).map((group) => {
    const choice = group.choices.find((c) => c.id === line.choices?.[group.id]) ?? group.choices[0];
    return { groupId: group.id, groupName: group.name, isDefault: choice.id === group.choices[0].id, ...choice };
  });
  return {
    itemId: item.id,
    name: item.name,
    emoji: item.emoji,
    available: item.available,
    qty: line.qty,
    choices: Object.fromEntries(selected.map((c) => [c.groupId, c.id])),
    choiceSummary: selected.filter((c) => !c.isDefault).map((c) => c.name).join(', '),
    unitPrice: item.price + selected.reduce((sum, c) => sum + c.priceDelta, 0),
    prepMinutes: item.prepMinutes + selected.reduce((sum, c) => sum + c.prepDelta, 0),
  };
}

export const linesTotal = (lines) => roundMoney(lines.reduce((sum, l) => sum + l.unitPrice * l.qty, 0));
export const orderPrepMinutes = (lines) => lines.reduce((sum, l) => sum + l.prepMinutes * l.qty, 0);
export const itemCount = (lines) => lines.reduce((sum, l) => sum + l.qty, 0);
export const summarizeLines = (lines) => lines.map((l) => `${l.qty}× ${l.name}`).join(', ');

export const isInKitchen = (order) =>
  order.status === ORDER_STATUS.QUEUED || order.status === ORDER_STATUS.PREPARING;

export const isActiveOrder = (order) =>
  order.status !== ORDER_STATUS.CANCELLED &&
  (order.status !== ORDER_STATUS.COLLECTED || order.delivery?.status === DELIVERY_STATUS.PICKED_UP);

/** The outlet's single FIFO line, lowest sequence number first. */
export const outletQueue = (orders, outletId) =>
  orders.filter((o) => o.outletId === outletId && isInKitchen(o)).sort((a, b) => a.seq - b.seq);

/** FR-03: orders ahead that have not reached Ready. */
export const ordersAhead = (order, orders) =>
  outletQueue(orders, order.outletId).filter((o) => o.seq < order.seq);

export function remainingMinutes(order, now) {
  const prep = orderPrepMinutes(order.lines);
  if (order.status === ORDER_STATUS.QUEUED) return prep;
  if (order.status !== ORDER_STATUS.PREPARING) return 0;
  return Math.max(0, prep - (now - order.prepStartedAt) / MINUTE);
}

/** FR-04: remaining work on the current order, queued work ahead, and the customer's own order. */
export function estimateMinutes(order, orders, now) {
  if (!isInKitchen(order)) return 0;
  const aheadWork = ordersAhead(order, orders).reduce((sum, o) => sum + remainingMinutes(o, now), 0);
  return Math.ceil(aheadWork + remainingMinutes(order, now));
}

/** The wait before a new order placed now would start. */
export const outletWaitMinutes = (outletId, orders, now) =>
  Math.ceil(outletQueue(orders, outletId).reduce((sum, o) => sum + remainingMinutes(o, now), 0));

/** FR-05: edits and food cancellation need more than two orders ahead and no preparation. */
export function editLock(order, orders) {
  if (order.status !== ORDER_STATUS.QUEUED) {
    return { allowed: false, reason: 'Preparation has started, so this order can no longer be edited or cancelled.' };
  }
  const ahead = ordersAhead(order, orders).length;
  if (ahead <= 2) {
    return {
      allowed: false,
      reason: `Only ${ahead} ${ahead === 1 ? 'order is' : 'orders are'} ahead of yours, so this order can no longer be edited or cancelled.`,
    };
  }
  return { allowed: true, reason: null };
}

const STATUS_BADGES = {
  queued: { label: 'In queue', tone: 'secondary' },
  preparing: { label: 'Preparing', tone: 'primary' },
  ready: { label: 'Ready', tone: 'success' },
  collected: { label: 'Collected', tone: 'success' },
  cancelled: { label: 'Cancelled', tone: 'danger' },
};
export const orderBadge = (order) => STATUS_BADGES[order.status];

const DELIVERY_BADGES = {
  open: { label: 'Waiting for a courier', tone: 'warning' },
  assigned: { label: 'Courier assigned', tone: 'primary' },
  picked_up: { label: 'On the way', tone: 'primary' },
  delivered: { label: 'Delivered', tone: 'success' },
  cancelled: { label: 'Delivery cancelled', tone: 'danger' },
  courier_cancelled: { label: 'Courier cancelled', tone: 'danger' },
};
export const deliveryBadge = (delivery) => DELIVERY_BADGES[delivery.status];

export const destinationLabel = ({ address }) =>
  `${address.buildingName}, floor ${address.floor}, ${address.room}`;

export const hasActiveDelivery = (order) =>
  [DELIVERY_STATUS.OPEN, DELIVERY_STATUS.ASSIGNED, DELIVERY_STATUS.PICKED_UP, DELIVERY_STATUS.COURIER_CANCELLED]
    .includes(order.delivery?.status);

export const hasAssignedCourier = (order) =>
  [DELIVERY_STATUS.ASSIGNED, DELIVERY_STATUS.PICKED_UP].includes(order.delivery?.status);

export const courierActiveJob = (orders, courierId) =>
  orders.find((o) => o.delivery?.courierId === courierId && hasAssignedCourier(o));

export const walletBalance = (transactions, userId) =>
  roundMoney(transactions.filter((t) => t.ownerId === userId).reduce((sum, t) => sum + (t.walletDelta ?? 0), 0));

/** FR-12: couriers show "New courier" until they have enough history. */
export const MIN_RELIABILITY_HISTORY = 5;
export const isNewCourier = (stats) => stats.completed < MIN_RELIABILITY_HISTORY;
