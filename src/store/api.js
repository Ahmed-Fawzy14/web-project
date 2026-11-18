import { produce } from 'immer';
import { getBuilding, MINIMUM_DELIVERY_FEE, suggestDeliveryFee, walkingMinutes } from '../data/campus';
import { DEMO_PASSWORD } from '../data/seed';
import { money, orderNumber } from '../domain/format';
import {
  courierActiveJob,
  courierEarning,
  DELIVERY_STATUS,
  editLock,
  hasAssignedCourier,
  linesTotal,
  lineKey,
  MAX_QUANTITY,
  ORDER_STATUS,
  outletQueue,
  platformCommission,
  resolveLine,
  roundMoney,
  walletBalance,
} from '../domain/orders';
import { getState, resetDemoState, setState } from './store';

/**
 * The mock backend. Every command runs atomically and enforces the business
 * rules itself, so screens cannot create invalid or duplicate state.
 * Milestone 2 replaces these bodies with calls to the Express API.
 */
class ApiError extends Error {}
const fail = (message) => {
  throw new ApiError(message);
};

function command(fn) {
  return (...args) => {
    let result;
    try {
      const next = produce(getState(), (draft) => {
        draft.now = Date.now();
        result = fn(draft, ...args);
      });
      setState(next);
    } catch (error) {
      if (error instanceof ApiError) return { ok: false, error: error.message };
      throw error;
    }
    return { ok: true, ...result };
  };
}

const nextId = (d, prefix) => `${prefix}-${(d.counters.id += 1)}`;
const getUser = (d, id) => d.users.find((u) => u.id === id);
const getOutlet = (d, id) => d.outlets.find((o) => o.id === id);

function currentUser(d) {
  return getUser(d, d.session.userId) ?? fail('Please sign in to continue.');
}

function requireRole(d, role) {
  const user = currentUser(d);
  if (!user.roles.includes(role)) fail('Your account does not have access to this action.');
  if (role === 'customer' && user.verification.customer !== 'approved') fail('Your AUC ID has not been approved yet.');
  if (role === 'courier' && user.verification.courier !== 'approved') fail('Your courier verification has not been approved yet.');
  return user;
}

function ownOrder(d, orderId, user) {
  const order = d.orders.find((o) => o.id === orderId);
  if (!order || order.customerId !== user.id) fail('We could not find that order on your account.');
  return order;
}

function staffOrder(d, orderId, staff) {
  const order = d.orders.find((o) => o.id === orderId);
  if (!order || order.outletId !== staff.outletId) fail('That order belongs to another outlet.');
  return order;
}

function notify(d, userId, text, link = null) {
  if (!userId) return;
  d.notifications.unshift({ id: nextId(d, 'note'), userId, text, link, at: Date.now(), read: false });
  d.notifications.splice(60);
}

function addTransaction(d, fields) {
  d.transactions.unshift({ id: nextId(d, 'tx'), at: Date.now(), state: 'simulated', walletDelta: 0, method: 'wallet', orderId: null, ...fields });
}

const METHOD_LABEL = { card: 'Card', apple_pay: 'Apple Pay', wallet: 'Wallet' };

function charge(d, { userId, amount, method, orderId, note }) {
  if (!METHOD_LABEL[method]) fail('Choose a payment method.');
  if (d.demo.paymentOutcome === 'fail') {
    fail(`Your ${METHOD_LABEL[method]} payment was declined (simulated). You have not been charged. Try again or use another method.`);
  }
  if (method === 'wallet' && walletBalance(d.transactions, userId) < amount) {
    fail(`Your wallet balance is too low for ${money(amount)}. Choose another payment method.`);
  }
  addTransaction(d, { ownerId: userId, type: 'payment', amount, method, orderId, note, walletDelta: method === 'wallet' ? -amount : 0 });
}

function refund(d, { userId, amount, destination, originalMethod, orderId, note }) {
  const method = destination === 'wallet' ? 'wallet' : originalMethod;
  addTransaction(d, { ownerId: userId, type: 'refund', amount, method, orderId, note, walletDelta: method === 'wallet' ? amount : 0 });
}

function startNextOrder(d, outletId) {
  const queue = outletQueue(d.orders, outletId);
  if (queue.some((o) => o.status === ORDER_STATUS.PREPARING)) return;
  const next = queue[0];
  if (!next) return;
  next.status = ORDER_STATUS.PREPARING;
  next.prepStartedAt = Date.now();
  notify(d, next.customerId, `${getOutlet(d, outletId).name} started preparing order ${orderNumber(next.id)}.`, `/orders/${next.id}`);
}

function enqueue(d, { outlet, lines, source, customer, payment, wantsDelivery }) {
  const number = (d.counters.order += 1);
  const seq = d.counters.seq[outlet.id];
  d.counters.seq[outlet.id] += 1;
  const id = `ord-${number}`;
  d.orders.push({
    id,
    outletId: outlet.id,
    seq,
    status: ORDER_STATUS.QUEUED,
    source,
    customerId: customer?.id ?? null,
    customerName: customer?.name ?? 'Walk-in customer',
    lines,
    placedAt: Date.now(),
    prepStartedAt: null,
    readyAt: null,
    collectedAt: null,
    cancelledAt: null,
    payment,
    wantsDelivery,
    delivery: null,
  });
  if (customer) {
    const token = `PU-${number}`;
    d.handoffs[token] = { token, orderId: id, stage: 'customer_pickup', authorizedUserId: customer.id, usedAt: null };
  }
  startNextOrder(d, outlet.id);
  return id;
}

function validateDraftLines(outlet, rawLines) {
  if (!outlet) fail('That outlet is not available.');
  if (!outlet.open) fail(`${outlet.name} is closed right now.`);
  if (rawLines.length === 0) fail('Add at least one item.');
  return rawLines.map((raw) => {
    const line = resolveLine(outlet, raw);
    if (!line) fail('One of the items is no longer on the menu.');
    if (!line.available) fail(`${line.name} is unavailable right now. Remove it to continue.`);
    if (!Number.isInteger(line.qty) || line.qty < 1 || line.qty > MAX_QUANTITY) {
      fail(`Quantity for ${line.name} must be between 1 and ${MAX_QUANTITY}.`);
    }
    return line;
  });
}

function placePaidOrder(d, { outletId, rawLines, method, wantsDelivery }) {
  const customer = requireRole(d, 'customer');
  const outlet = getOutlet(d, outletId);
  const lines = validateDraftLines(outlet, rawLines);
  const amount = linesTotal(lines);
  const number = d.counters.order + 1;
  charge(d, { userId: customer.id, amount, method, orderId: `ord-${number}`, note: `Food order #${number}` });
  return enqueue(d, { outlet, lines, source: 'app', customer, payment: { method, amount }, wantsDelivery });
}

/* Accounts */

export const login = command((d, email, password) => {
  const user = d.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
  const valid = user && (user.demo ? password === DEMO_PASSWORD : password.length >= 8);
  if (!valid) fail('That email or password is not correct.');
  d.session = { userId: user.id, activeRole: user.roles[0] };
  return { user: { id: user.id, activeRole: user.roles[0] } };
});

export const logout = command((d) => {
  d.session = { userId: null, activeRole: null };
  d.cart = { outletId: null, lines: [] };
});

const DEMO_ROLE_ACCOUNTS = { customer: 'u-salma', courier: 'u-karim', restaurant: 'u-lina', admin: 'u-admin' };

export const switchDemoRole = command((d, role) => {
  d.session = { userId: DEMO_ROLE_ACCOUNTS[role], activeRole: role };
});

export const signInAsDemoUser = command((d, userId) => {
  const user = getUser(d, userId) ?? fail('That demo account does not exist.');
  d.session = { userId, activeRole: user.roles.includes('courier') ? 'courier' : user.roles[0] };
  return { activeRole: d.session.activeRole };
});

export const setActiveRole = command((d, role) => {
  const user = currentUser(d);
  if (!user.roles.includes(role)) fail('Your account does not have that role.');
  d.session.activeRole = role;
});

export const register = command((d, values, { courier = false } = {}) => {
  const email = values.email.trim().toLowerCase();
  if (d.users.some((u) => u.email.toLowerCase() === email)) fail('An account with this email already exists. Sign in instead.');
  if (courier && values.affiliation !== 'student') fail('Only current AUC students can register as couriers.');
  const id = nextId(d, 'u');
  d.users.push({
    id,
    name: values.name.trim(),
    email,
    phone: values.phone.replace(/[\s-]/g, ''),
    roles: ['customer'],
    affiliation: values.affiliation,
    verification: {
      customer: 'pending',
      courier: courier ? 'pending' : 'none',
      idFileName: values.idFile.name,
      rejectReason: null,
    },
    courierStats: courier ? { completed: 0, completionRate: 100, cancellations: 0, missedPickups: 0, rating: null } : null,
    outletId: null,
    demo: false,
    appliedAt: Date.now(),
  });
  d.session = { userId: id, activeRole: 'customer' };
});

export const applyAsCourier = command((d, { idFile, studentConfirmed }) => {
  const user = currentUser(d);
  if (user.affiliation !== 'student' || !studentConfirmed) fail('Only verified current AUC students can register as couriers.');
  if (user.verification.courier === 'approved') fail('You are already a verified courier.');
  user.verification.courier = 'pending';
  user.verification.idFileName = idFile.name;
  user.verification.rejectReason = null;
  user.appliedAt = Date.now();
  user.courierStats ??= { completed: 0, completionRate: 100, cancellations: 0, missedPickups: 0, rating: null };
});

export const resubmitId = command((d, idFile) => {
  const user = currentUser(d);
  user.verification.customer = 'pending';
  user.verification.idFileName = idFile.name;
  user.verification.rejectReason = null;
  user.appliedAt = Date.now();
});

export const updateProfile = command((d, { name, phone }) => {
  const user = currentUser(d);
  user.name = name.trim();
  user.phone = phone.replace(/[\s-]/g, '');
});

/* Cart */

export const addToCart = command((d, outletId, line) => {
  const outlet = getOutlet(d, outletId);
  if (!outlet?.open) fail(`${outlet?.name ?? 'This outlet'} is closed right now.`);
  const resolved = resolveLine(outlet, line);
  if (!resolved?.available) fail('This item is unavailable right now.');
  if (d.cart.outletId !== outletId) d.cart = { outletId, lines: [] };
  const key = lineKey(line);
  const existing = d.cart.lines.find((l) => lineKey(l) === key);
  const qty = (existing?.qty ?? 0) + line.qty;
  if (qty > MAX_QUANTITY) fail(`You can order up to ${MAX_QUANTITY} of each item.`);
  if (existing) existing.qty = qty;
  else d.cart.lines.push({ itemId: line.itemId, qty: line.qty, choices: line.choices });
});

export const setCartQuantity = command((d, key, qty) => {
  if (qty > MAX_QUANTITY) fail(`You can order up to ${MAX_QUANTITY} of each item.`);
  d.cart.lines = d.cart.lines
    .map((l) => (lineKey(l) === key ? { ...l, qty } : l))
    .filter((l) => l.qty > 0);
  if (d.cart.lines.length === 0) d.cart.outletId = null;
});

export const orderAgain = command((d, orderId) => {
  const order = ownOrder(d, orderId, currentUser(d));
  const outlet = getOutlet(d, order.outletId);
  const lines = order.lines
    .filter((l) => outlet.menu.some((i) => i.id === l.itemId && i.available))
    .map((l) => ({ itemId: l.itemId, qty: l.qty, choices: l.choices }));
  if (lines.length === 0) fail('None of these items are available right now.');
  d.cart = { outletId: order.outletId, lines };
});

/* Food orders */

export const placeOrder = command((d, { method, wantsDelivery }) => {
  if (d.cart.lines.length === 0) fail('Your cart is empty.');
  const orderId = placePaidOrder(d, { outletId: d.cart.outletId, rawLines: d.cart.lines, method, wantsDelivery });
  d.cart = { outletId: null, lines: [] };
  return { orderId };
});

/** The assistant uses the same rules, payment and queue path as the normal checkout. */
export const placeAssistantOrder = command((d, draft, method) => ({
  orderId: placePaidOrder(d, { outletId: draft.outletId, rawLines: draft.lines, method, wantsDelivery: false }),
}));

export const editOrder = command((d, orderId, rawLines, { method, refundDestination }) => {
  const user = requireRole(d, 'customer');
  const order = ownOrder(d, orderId, user);
  const lock = editLock(order, d.orders);
  if (!lock.allowed) fail(lock.reason);
  const lines = validateDraftLines(getOutlet(d, order.outletId), rawLines);
  const total = linesTotal(lines);
  const difference = roundMoney(total - order.payment.amount);
  if (difference > 0) {
    charge(d, { userId: user.id, amount: difference, method, orderId, note: `Edit to order ${orderNumber(orderId)}` });
  } else if (difference < 0) {
    refund(d, { userId: user.id, amount: -difference, destination: refundDestination, originalMethod: order.payment.method, orderId, note: `Edit to order ${orderNumber(orderId)}` });
  }
  order.lines = lines;
  order.payment.amount = total;
  return { difference };
});

export const cancelOrder = command((d, orderId, destination) => {
  const user = requireRole(d, 'customer');
  const order = ownOrder(d, orderId, user);
  const lock = editLock(order, d.orders);
  if (!lock.allowed) fail(lock.reason);
  if (hasAssignedCourier(order)) fail('A courier is assigned. Cancel from the delivery page so the agreed fee is settled.');
  refund(d, { userId: user.id, amount: order.payment.amount, destination, originalMethod: order.payment.method, orderId, note: `Cancelled order ${orderNumber(orderId)}` });
  order.status = ORDER_STATUS.CANCELLED;
  order.cancelledAt = Date.now();
  if (order.delivery) order.delivery.status = DELIVERY_STATUS.CANCELLED;
  delete d.handoffs[`PU-${orderId.replace('ord-', '')}`];
  notify(d, user.id, `Order ${orderNumber(orderId)} was cancelled and your refund is recorded.`, `/orders/${orderId}`);
});

/* Delivery requests */

export const postDelivery = command((d, orderId, address, fee) => {
  const user = requireRole(d, 'customer');
  const order = ownOrder(d, orderId, user);
  if ([ORDER_STATUS.CANCELLED, ORDER_STATUS.COLLECTED].includes(order.status)) fail('This order can no longer be delivered.');
  if (order.delivery && ![DELIVERY_STATUS.CANCELLED].includes(order.delivery.status)) fail('This order already has a delivery request.');
  const amount = Number(fee);
  if (!(amount >= MINIMUM_DELIVERY_FEE)) fail(`The delivery fee must be at least EGP ${MINIMUM_DELIVERY_FEE}.`);
  const building = getBuilding(address.buildingId) ?? fail('Choose a campus building.');
  const minutes = walkingMinutes(getBuilding(getOutlet(d, order.outletId).buildingId), address.pin);
  order.wantsDelivery = true;
  order.delivery = {
    status: DELIVERY_STATUS.OPEN,
    address: { ...address, buildingName: building.name },
    walkMinutes: minutes,
    suggestedFee: suggestDeliveryFee(minutes),
    fee: amount,
    feePaid: false,
    feeMethod: null,
    courierId: null,
    bids: [],
    attempt: 0,
    postedAt: Date.now(),
    assignedAt: null,
    pickedUpAt: null,
    deliveredAt: null,
    settled: false,
    rating: null,
  };
});

export const raiseDeliveryFee = command((d, orderId, fee) => {
  const order = ownOrder(d, orderId, requireRole(d, 'customer'));
  if (order.delivery?.status !== DELIVERY_STATUS.OPEN) fail('The fee can only change before a courier is assigned.');
  const amount = Number(fee);
  if (!(amount > order.delivery.fee)) fail(`Enter more than the current ${money(order.delivery.fee)}.`);
  order.delivery.fee = amount;
});

export const collectMyself = command((d, orderId) => {
  const order = ownOrder(d, orderId, requireRole(d, 'customer'));
  const { delivery } = order;
  if (![DELIVERY_STATUS.OPEN, DELIVERY_STATUS.COURIER_CANCELLED].includes(delivery?.status)) fail('This delivery can no longer be switched to pickup.');
  if (delivery.feePaid) {
    refund(d, { userId: order.customerId, amount: delivery.fee, destination: 'original', originalMethod: delivery.feeMethod, orderId, note: `Delivery fee returned for ${orderNumber(orderId)}` });
    delivery.feePaid = false;
  }
  delivery.status = DELIVERY_STATUS.CANCELLED;
  order.wantsDelivery = false;
});

function assignCourier(d, order, courierId, fee) {
  const { delivery } = order;
  delivery.status = DELIVERY_STATUS.ASSIGNED;
  delivery.courierId = courierId;
  delivery.fee = fee;
  delivery.assignedAt = Date.now();
  delivery.attempt += 1;
  delivery.bids.forEach((b) => {
    if (b.state === 'pending') b.state = b.courierId === courierId ? 'accepted' : 'declined';
  });
  const number = order.id.replace('ord-', '');
  const pickupToken = `CP-${number}-${delivery.attempt}`;
  const deliveryToken = `DL-${number}-${delivery.attempt}`;
  d.handoffs[pickupToken] = { token: pickupToken, orderId: order.id, stage: 'courier_pickup', authorizedUserId: courierId, usedAt: null };
  d.handoffs[deliveryToken] = { token: deliveryToken, orderId: order.id, stage: 'delivery', authorizedUserId: courierId, usedAt: null };
  delivery.pickupToken = pickupToken;
  delivery.deliveryToken = deliveryToken;
  const customer = getUser(d, order.customerId);
  if (customer.autoPayDelivery && !delivery.feePaid) {
    addTransaction(d, { ownerId: customer.id, type: 'payment', amount: fee, method: 'card', orderId: order.id, note: `Delivery fee ${orderNumber(order.id)}` });
    delivery.feePaid = true;
    delivery.feeMethod = 'card';
  }
  notify(d, customer.id, `${getUser(d, courierId).name} is assigned to order ${orderNumber(order.id)}.`, `/orders/${order.id}/delivery`);
  notify(d, courierId, `You are assigned to order ${orderNumber(order.id)} for ${money(fee)}.`, `/courier/jobs/${order.id}`);
}

function openJob(d, orderId) {
  const order = d.orders.find((o) => o.id === orderId);
  if (order?.delivery?.status !== DELIVERY_STATUS.OPEN) fail('Another courier has already taken this delivery.');
  return order;
}

export const acceptJob = command((d, orderId) => {
  const courier = requireRole(d, 'courier');
  const order = openJob(d, orderId);
  if (order.customerId === courier.id) fail('You cannot deliver your own order.');
  if (courierActiveJob(d.orders, courier.id)) fail('Finish your active delivery before accepting another.');
  if (d.demo.competingCourier) {
    d.demo.competingCourier = false;
    assignCourier(d, order, 'u-mariam', order.delivery.fee);
    return { ok: false, error: 'Another courier accepted this delivery first (simulated). It is no longer available.' };
  }
  assignCourier(d, order, courier.id, order.delivery.fee);
  return {};
});

export const submitCounteroffer = command((d, orderId, amount) => {
  const courier = requireRole(d, 'courier');
  const order = openJob(d, orderId);
  if (order.customerId === courier.id) fail('You cannot deliver your own order.');
  if (courierActiveJob(d.orders, courier.id)) fail('Finish your active delivery before making another offer.');
  const value = Number(amount);
  if (!(value > 0) || value === order.delivery.fee) fail('Enter a price different from the offered fee.');
  const existing = order.delivery.bids.find((b) => b.courierId === courier.id && b.state === 'pending');
  if (existing) {
    existing.amount = value;
    existing.at = Date.now();
  } else {
    order.delivery.bids.push({ id: nextId(d, 'bid'), courierId: courier.id, amount: value, state: 'pending', at: Date.now() });
  }
  notify(d, order.customerId, `${courier.name} offered ${money(value)} for order ${orderNumber(orderId)}.`, `/orders/${orderId}/delivery`);
});

export const acceptBid = command((d, orderId, bidId) => {
  const order = ownOrder(d, orderId, requireRole(d, 'customer'));
  if (order.delivery?.status !== DELIVERY_STATUS.OPEN) fail('This delivery already has a courier.');
  const bid = order.delivery.bids.find((b) => b.id === bidId && b.state === 'pending') ?? fail('That offer is no longer available.');
  if (courierActiveJob(d.orders, bid.courierId)) fail('This courier has just started another delivery. Choose another offer.');
  assignCourier(d, order, bid.courierId, bid.amount);
});

export const declineBid = command((d, orderId, bidId) => {
  const order = ownOrder(d, orderId, requireRole(d, 'customer'));
  const bid = order.delivery?.bids.find((b) => b.id === bidId && b.state === 'pending') ?? fail('That offer is no longer available.');
  bid.state = 'declined';
  notify(d, bid.courierId, `Your offer on order ${orderNumber(orderId)} was declined.`, '/courier');
});

export const payDeliveryFee = command((d, orderId, method) => {
  const user = requireRole(d, 'customer');
  const order = ownOrder(d, orderId, user);
  const { delivery } = order;
  if (!hasAssignedCourier(order)) fail('The delivery fee is paid once a courier is assigned.');
  if (delivery.feePaid) fail('This delivery fee has already been paid.');
  charge(d, { userId: user.id, amount: delivery.fee, method, orderId, note: `Delivery fee ${orderNumber(orderId)}` });
  delivery.feePaid = true;
  delivery.feeMethod = method;
});

function settleCourier(d, order, kind) {
  const { delivery } = order;
  if (delivery.settled) return;
  delivery.settled = true;
  const earning = courierEarning(delivery.fee);
  addTransaction(d, {
    ownerId: delivery.courierId,
    type: kind === 'delivery' ? 'earning' : 'cancellation_compensation',
    amount: earning,
    walletDelta: earning,
    orderId: order.id,
    note: `${kind === 'delivery' ? 'Delivery' : 'Cancelled delivery'} ${orderNumber(order.id)}: 95% of ${money(delivery.fee)}`,
  });
  addTransaction(d, {
    ownerId: 'platform',
    type: 'commission',
    amount: platformCommission(delivery.fee),
    orderId: order.id,
    note: `${orderNumber(order.id)}: 5% of ${money(delivery.fee)}`,
  });
}

function voidCourierTokens(d, delivery) {
  delete d.handoffs[delivery.pickupToken];
  delete d.handoffs[delivery.deliveryToken];
}

export const customerCancelDelivery = command((d, orderId, { scope, method, destination }) => {
  const user = requireRole(d, 'customer');
  const order = ownOrder(d, orderId, user);
  const { delivery } = order;
  if (delivery?.status === DELIVERY_STATUS.PICKED_UP) fail('The courier already has your food. Contact support so a person can review this.');
  if (delivery?.status !== DELIVERY_STATUS.ASSIGNED) fail('There is no assigned delivery to cancel.');
  if (scope === 'order') {
    const lock = editLock(order, d.orders);
    if (!lock.allowed) fail(lock.reason);
  }
  if (!delivery.feePaid) {
    charge(d, { userId: user.id, amount: delivery.fee, method, orderId, note: `Delivery fee owed after cancelling ${orderNumber(orderId)}` });
    delivery.feePaid = true;
    delivery.feeMethod = method;
  }
  settleCourier(d, order, 'cancellation');
  voidCourierTokens(d, delivery);
  delivery.status = DELIVERY_STATUS.CANCELLED;
  order.wantsDelivery = false;
  notify(d, delivery.courierId, `Order ${orderNumber(orderId)} was cancelled. Your 95% share is in your wallet.`, '/wallet');
  if (scope === 'order') {
    refund(d, { userId: user.id, amount: order.payment.amount, destination, originalMethod: order.payment.method, orderId, note: `Cancelled order ${orderNumber(orderId)}` });
    order.status = ORDER_STATUS.CANCELLED;
    order.cancelledAt = Date.now();
    delete d.handoffs[`PU-${orderId.replace('ord-', '')}`];
  }
});

export const courierCancelJob = command((d, orderId) => {
  const courier = requireRole(d, 'courier');
  const order = d.orders.find((o) => o.id === orderId);
  const delivery = order?.delivery;
  if (delivery?.courierId !== courier.id) fail('This delivery is not assigned to you.');
  if (delivery.status !== DELIVERY_STATUS.ASSIGNED) fail('You can only cancel before picking up the food.');
  voidCourierTokens(d, delivery);
  delivery.status = DELIVERY_STATUS.COURIER_CANCELLED;
  delivery.courierId = null;
  courier.courierStats.cancellations += 1;
  notify(d, order.customerId, `Your courier cancelled order ${orderNumber(orderId)}. Choose what happens next.`, `/orders/${orderId}/delivery`);
});

export const reopenDelivery = command((d, orderId) => {
  const order = ownOrder(d, orderId, requireRole(d, 'customer'));
  if (order.delivery?.status !== DELIVERY_STATUS.COURIER_CANCELLED) fail('This delivery cannot be reopened.');
  order.delivery.status = DELIVERY_STATUS.OPEN;
  order.delivery.bids = [];
  order.delivery.postedAt = Date.now();
});

export const rateCourier = command((d, orderId, rating) => {
  const order = ownOrder(d, orderId, requireRole(d, 'customer'));
  const { delivery } = order;
  if (delivery?.status !== DELIVERY_STATUS.DELIVERED) fail('You can rate a courier after delivery.');
  if (delivery.rating) fail('You have already rated this delivery.');
  delivery.rating = rating;
  const { courierStats } = getUser(d, delivery.courierId);
  const past = courierStats.rating ?? rating;
  courierStats.rating = roundMoney((past * courierStats.completed + rating) / (courierStats.completed + 1));
});

/* QR handoffs */

export const scanAtOutlet = command((d, rawToken) => {
  const staff = requireRole(d, 'restaurant');
  const token = rawToken.trim().toUpperCase();
  const handoff = d.handoffs[token] ?? fail('This code is not valid.');
  if (handoff.usedAt) fail('This code has already been used.');
  if (handoff.stage === 'delivery') fail('This is a delivery code. Only the assigned courier can scan it at drop-off.');
  const order = staffOrder(d, handoff.orderId, staff);
  if (order.status !== ORDER_STATUS.READY) fail(`Order ${orderNumber(order.id)} is not Ready yet.`);
  if (handoff.stage === 'customer_pickup') {
    if (hasAssignedCourier(order)) fail('A courier is assigned to this order. Scan the courier’s code instead.');
    handoff.usedAt = Date.now();
    order.status = ORDER_STATUS.COLLECTED;
    order.collectedAt = Date.now();
    if ([DELIVERY_STATUS.OPEN, DELIVERY_STATUS.COURIER_CANCELLED].includes(order.delivery?.status)) {
      if (order.delivery.feePaid) {
        refund(d, { userId: order.customerId, amount: order.delivery.fee, destination: 'original', originalMethod: order.delivery.feeMethod, orderId: order.id, note: `Delivery fee returned for ${orderNumber(order.id)}` });
        order.delivery.feePaid = false;
      }
      order.delivery.status = DELIVERY_STATUS.CANCELLED;
    }
    notify(d, order.customerId, `Order ${orderNumber(order.id)} was collected.`, `/orders/${order.id}`);
    return { message: `Order ${orderNumber(order.id)} handed to ${order.customerName}.` };
  }
  const { delivery } = order;
  if (delivery?.status !== DELIVERY_STATUS.ASSIGNED || delivery.courierId !== handoff.authorizedUserId) fail('This code does not match the assigned courier.');
  if (!delivery.feePaid) fail('The customer has not paid the delivery fee yet.');
  handoff.usedAt = Date.now();
  order.status = ORDER_STATUS.COLLECTED;
  order.collectedAt = Date.now();
  delivery.status = DELIVERY_STATUS.PICKED_UP;
  delivery.pickedUpAt = Date.now();
  notify(d, order.customerId, `Your courier picked up order ${orderNumber(order.id)}.`, `/orders/${order.id}/delivery`);
  return { message: `Order ${orderNumber(order.id)} handed to ${getUser(d, delivery.courierId).name}.` };
});

export const scanDeliveryCode = command((d, orderId, rawToken) => {
  const courier = requireRole(d, 'courier');
  const token = rawToken.trim().toUpperCase();
  const handoff = d.handoffs[token] ?? fail('This code is not valid.');
  if (handoff.usedAt) fail('This code has already been used.');
  if (handoff.orderId !== orderId) fail('This code belongs to a different order.');
  if (handoff.stage !== 'delivery') fail('This is not the customer’s delivery code.');
  if (handoff.authorizedUserId !== courier.id) fail('Only the assigned courier can complete this delivery.');
  const order = d.orders.find((o) => o.id === orderId);
  if (order.delivery.status !== DELIVERY_STATUS.PICKED_UP) fail('Collect the food from the outlet before completing delivery.');
  handoff.usedAt = Date.now();
  order.delivery.status = DELIVERY_STATUS.DELIVERED;
  order.delivery.deliveredAt = Date.now();
  settleCourier(d, order, 'delivery');
  courier.courierStats.completed += 1;
  notify(d, order.customerId, `Order ${orderNumber(orderId)} was delivered. Enjoy your meal!`, `/orders/${orderId}/delivery`);
  return { earning: courierEarning(order.delivery.fee) };
});

/* Restaurant */

export const markOrderReady = command((d, orderId) => {
  const staff = requireRole(d, 'restaurant');
  const order = staffOrder(d, orderId, staff);
  if (order.status !== ORDER_STATUS.PREPARING) fail('Only the order being prepared can be marked Ready.');
  order.status = ORDER_STATUS.READY;
  order.readyAt = Date.now();
  startNextOrder(d, order.outletId);
  notify(d, order.customerId, `Order ${orderNumber(orderId)} is ready.`, `/orders/${orderId}`);
  if (hasAssignedCourier(order)) notify(d, order.delivery.courierId, `Order ${orderNumber(orderId)} is ready for pickup.`, `/courier/jobs/${orderId}`);
});

export const addWalkIn = command((d, rawLines) => {
  const staff = requireRole(d, 'restaurant');
  const outlet = getOutlet(d, staff.outletId);
  const lines = validateDraftLines(outlet, rawLines);
  return { orderId: enqueue(d, { outlet, lines, source: 'walk_in', customer: null, payment: null, wantsDelivery: false }) };
});

export const collectWalkIn = command((d, orderId) => {
  const order = staffOrder(d, orderId, requireRole(d, 'restaurant'));
  if (order.source !== 'walk_in' || order.status !== ORDER_STATUS.READY) fail('This order cannot be marked collected.');
  order.status = ORDER_STATUS.COLLECTED;
  order.collectedAt = Date.now();
});

export const saveMenuItem = command((d, itemId, values) => {
  const staff = requireRole(d, 'restaurant');
  const outlet = getOutlet(d, staff.outletId);
  const fields = {
    name: values.name.trim(),
    price: Number(values.price),
    prepMinutes: Number(values.prepMinutes),
    category: values.category.trim() || 'Menu',
  };
  if (!fields.name) fail('Enter an item name.');
  if (!(fields.price > 0)) fail('Enter a price above zero.');
  if (!(fields.prepMinutes >= 1)) fail('Preparation time must be at least 1 minute.');
  if (itemId) {
    Object.assign(outlet.menu.find((i) => i.id === itemId) ?? fail('That item no longer exists.'), fields);
  } else {
    outlet.menu.push({ ...fields, id: nextId(d, 'item'), emoji: '🍽️', description: '', aliases: [fields.name.toLowerCase()], options: [], available: true });
  }
});

export const setItemAvailability = command((d, itemId, available) => {
  const outlet = getOutlet(d, requireRole(d, 'restaurant').outletId);
  (outlet.menu.find((i) => i.id === itemId) ?? fail('That item no longer exists.')).available = available;
});

/* Wallet */

export const requestWithdrawal = command((d, amount) => {
  const courier = requireRole(d, 'courier');
  const value = Number(amount);
  if (!(value > 0)) fail('Enter an amount above zero.');
  if (value > walletBalance(d.transactions, courier.id)) fail('You cannot withdraw more than your wallet balance.');
  if (d.demo.paymentOutcome === 'fail') fail('The withdrawal failed (simulated). Your balance has not changed. Please try again.');
  addTransaction(d, { ownerId: courier.id, type: 'withdrawal', amount: value, walletDelta: -value, method: 'bank', note: 'Simulated withdrawal request' });
  return { amount: value };
});

/* Support and admin */

export const escalateToHuman = command((d, { reason, transcript, orderId }) => {
  const user = currentUser(d);
  const id = nextId(d, 'case');
  d.supportCases.unshift({ id, userId: user.id, userName: user.name, orderId: orderId ?? null, reason, status: 'open', createdAt: Date.now(), transcript, resolution: null });
  d.users.filter((u) => u.roles.includes('admin')).forEach((admin) => notify(d, admin.id, `New support case from ${user.name}.`, '/admin'));
  return { caseId: id };
});

export const reviewApplication = command((d, userId, kind, decision, reason) => {
  requireRole(d, 'admin');
  const user = getUser(d, userId) ?? fail('That application no longer exists.');
  if (user.verification[kind] !== 'pending') fail('This application has already been reviewed.');
  if (decision === 'rejected' && !reason?.trim()) fail('Add a reason so the applicant knows what to fix.');
  user.verification[kind] = decision;
  user.verification.rejectReason = decision === 'rejected' ? reason.trim() : null;
  if (decision === 'approved' && kind === 'courier' && !user.roles.includes('courier')) user.roles.push('courier');
  notify(d, userId, decision === 'approved'
    ? `Your ${kind} application was approved.`
    : `Your ${kind} application was not approved: ${reason.trim()}`);
});

export const resolveSupportCase = command((d, caseId, { outcome, note, refundAmount }) => {
  const admin = requireRole(d, 'admin');
  const supportCase = d.supportCases.find((c) => c.id === caseId) ?? fail('That case no longer exists.');
  if (supportCase.status !== 'open') fail('This case is already resolved.');
  if (!note.trim()) fail('Add a resolution note.');
  const amount = outcome === 'refund' ? Number(refundAmount) : 0;
  if (outcome === 'refund') {
    if (!(amount > 0)) fail('Enter a refund amount above zero.');
    refund(d, { userId: supportCase.userId, amount, destination: 'wallet', orderId: supportCase.orderId, note: `Support case ${caseId}: ${note.trim()}` });
  }
  supportCase.status = 'resolved';
  supportCase.resolution = { outcome, note: note.trim(), amount, by: admin.name, at: Date.now() };
  notify(d, supportCase.userId, `Your support case was resolved: ${note.trim()}`, '/support');
});

/* Notifications and demo controls */

export const markNotificationsRead = command((d) => {
  d.notifications.forEach((n) => {
    if (n.userId === d.session.userId) n.read = true;
  });
});

export const setDemoControl = command((d, key, value) => {
  d.demo[key] = value;
});

export const resetDemo = () => {
  resetDemoState();
  return { ok: true };
};
