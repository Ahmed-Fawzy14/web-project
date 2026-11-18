import { getBuilding, suggestDeliveryFee, walkingMinutes } from './campus';
import { DELIVERY_STATUS, ORDER_STATUS, resolveLine } from '../domain/orders';

/** All people, outlets, prices, phone numbers and orders here are fictional demo data. */
export const DEMO_PASSWORD = 'demo1234';
export const STATE_VERSION = 1;

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const size = {
  id: 'size',
  name: 'Size',
  choices: [
    { id: 'regular', name: 'Regular', priceDelta: 0, prepDelta: 0, aliases: ['regular', 'عادي'] },
    { id: 'large', name: 'Large', priceDelta: 15, prepDelta: 1, aliases: ['large', 'كبير'] },
  ],
};
const milk = {
  id: 'milk',
  name: 'Milk',
  choices: [
    { id: 'whole', name: 'Whole milk', priceDelta: 0, prepDelta: 0, aliases: ['whole milk'] },
    { id: 'oat', name: 'Oat milk', priceDelta: 20, prepDelta: 0, aliases: ['oat', 'شوفان'] },
  ],
};
const spice = {
  id: 'spice',
  name: 'Spice level',
  choices: [
    { id: 'mild', name: 'Mild', priceDelta: 0, prepDelta: 0, aliases: ['mild'] },
    { id: 'hot', name: 'Hot', priceDelta: 0, prepDelta: 0, aliases: ['hot', 'spicy', 'حار', 'سبايسي'] },
  ],
};

const item = (id, name, price, prepMinutes, emoji, category, description, aliases, options = [], available = true) => ({
  id, name, price, prepMinutes, emoji, category, description, aliases, options, available,
});

const createOutlets = () => [
  {
    id: 'outlet-a',
    code: 'Outlet A',
    name: 'Nile Bean Café',
    cuisine: 'Coffee & bakery',
    location: 'Campus Center',
    buildingId: 'campus-center',
    hours: '8:00 to 20:00',
    open: true,
    emoji: '☕',
    aliases: ['outlet a', 'nile bean', 'منفذ أ', 'منفذ ا', 'نايل بين'],
    menu: [
      item('espresso', 'Espresso', 60, 2, '☕', 'Coffee', 'Double shot, rich and short.', ['espresso', 'اسبريسو', 'إسبريسو'], [size]),
      item('latte', 'Latte', 80, 3, '🥛', 'Coffee', 'Espresso with steamed milk.', ['latte', 'لاتيه'], [size, milk]),
      item('iced-latte', 'Iced Latte', 90, 3, '🧊', 'Coffee', 'Chilled espresso, milk and ice.', ['iced latte', 'ice latte', 'لاتيه مثلج', 'ايس لاتيه'], [size, milk]),
      item('matcha', 'Matcha Latte', 95, 4, '🍵', 'Coffee', 'Stone-ground matcha and milk.', ['matcha', 'ماتشا'], [size, milk], false),
      item('croissant', 'Butter Croissant', 55, 1, '🥐', 'Bakery', 'Baked fresh every morning.', ['croissant', 'كرواسون', 'كرواسان']),
      item('pesto-sandwich', 'Pesto Chicken Sandwich', 120, 6, '🥪', 'Bakery', 'Grilled chicken, basil pesto, ciabatta.', ['pesto sandwich', 'chicken sandwich', 'ساندوتش فراخ']),
    ],
  },
  {
    id: 'outlet-b',
    code: 'Outlet B',
    name: 'Lotus Wok',
    cuisine: 'Asian kitchen',
    location: 'Food Court',
    buildingId: 'plaza',
    hours: '10:00 to 21:00',
    open: true,
    emoji: '🍜',
    aliases: ['outlet b', 'lotus wok', 'lotus', 'منفذ ب', 'لوتس'],
    menu: [
      item('teriyaki-bowl', 'Teriyaki Chicken Bowl', 145, 7, '🍱', 'Mains', 'Glazed chicken over steamed rice.', ['teriyaki', 'تيرياكي'], [spice]),
      item('noodles', 'Wok Noodles', 120, 6, '🍜', 'Mains', 'Stir-fried noodles with vegetables.', ['noodles', 'نودلز'], [spice]),
      item('spring-rolls', 'Spring Rolls', 75, 5, '🥟', 'Sides', 'Four crispy rolls with sweet chili.', ['spring rolls', 'spring roll', 'سبرنج رول']),
      item('lotus-espresso', 'Espresso', 55, 2, '☕', 'Drinks', 'Double shot, rich and short.', ['espresso', 'اسبريسو', 'إسبريسو']),
      item('iced-tea', 'Iced Peach Tea', 65, 2, '🧋', 'Drinks', 'Black tea, peach and ice.', ['iced tea', 'peach tea', 'شاي مثلج']),
    ],
  },
  {
    id: 'outlet-c',
    code: 'Outlet C',
    name: 'Baladi Corner',
    cuisine: 'Egyptian street food',
    location: 'Food Court',
    buildingId: 'plaza',
    hours: '8:00 to 18:00',
    open: true,
    emoji: '🧆',
    aliases: ['outlet c', 'baladi corner', 'baladi', 'منفذ ج', 'بلدي'],
    menu: [
      item('taameya', "Ta'ameya Sandwich", 35, 3, '🧆', 'Sandwiches', 'Crispy falafel, tahini and salad.', ['taameya', "ta'ameya", 'falafel', 'طعمية']),
      item('foul', 'Foul Sandwich', 30, 2, '🥙', 'Sandwiches', 'Slow-cooked fava beans in baladi bread.', ['foul', 'فول']),
      item('hawawshi', 'Hawawshi', 70, 8, '🫓', 'Sandwiches', 'Spiced minced beef baked in bread.', ['hawawshi', 'حواوشي'], [spice]),
      item('koshari', 'Koshari Bowl', 85, 5, '🍲', 'Plates', 'Rice, lentils, pasta and spicy tomato.', ['koshari', 'كشري'], [spice]),
      item('karkade', 'Iced Karkade', 40, 1, '🍹', 'Drinks', 'Chilled hibiscus, lightly sweet.', ['karkade', 'كركديه']),
    ],
  },
  {
    id: 'outlet-d',
    code: 'Outlet D',
    name: 'Sundial Sweets',
    cuisine: 'Desserts',
    location: 'Library Terrace',
    buildingId: 'library',
    hours: 'Opens tomorrow at 9:00',
    open: false,
    emoji: '🍰',
    aliases: ['outlet d', 'sundial', 'منفذ د'],
    menu: [
      item('basbousa', 'Basbousa Slice', 45, 1, '🍰', 'Sweets', 'Semolina cake with syrup.', ['basbousa', 'بسبوسة']),
    ],
  },
];

const verified = { customer: 'approved', courier: 'none', idFileName: 'demo-id.png', rejectReason: null };
const noCourierStats = null;

const user = (id, name, email, phone, roles, extra = {}) => ({
  id, name, email, phone, roles,
  affiliation: 'student',
  verification: { ...verified, ...(roles.includes('courier') ? { courier: 'approved' } : {}) },
  courierStats: noCourierStats,
  outletId: null,
  demo: true,
  ...extra,
});

const stats = (completed, completionRate, cancellations, missedPickups, rating) => ({
  completed, completionRate, cancellations, missedPickups, rating,
});

const createUsers = (now) => [
  user('u-salma', 'Salma Hassan', 'salma.demo@aucegypt.edu', '01005550101', ['customer']),
  user('u-karim', 'Karim Adel', 'karim.demo@aucegypt.edu', '01005550102', ['customer', 'courier'], {
    courierStats: stats(42, 96, 1, 0, 4.8),
  }),
  user('u-mariam', 'Mariam Fouad', 'mariam.demo@aucegypt.edu', '01005550103', ['customer', 'courier'], {
    courierStats: stats(18, 100, 0, 0, 4.9),
  }),
  user('u-hady', 'Hady Samir', 'hady.demo@aucegypt.edu', '01005550104', ['customer', 'courier'], {
    courierStats: stats(1, 100, 0, 0, null),
  }),
  user('u-nour', 'Nour Amin', 'nour.demo@aucegypt.edu', '01005550105', ['customer'], { autoPayDelivery: true }),
  user('u-omar', 'Omar Khaled', 'omar.demo@aucegypt.edu', '01005550106', ['customer'], { autoPayDelivery: true }),
  user('u-lina', 'Lina Staff', 'lina.staff@aucegypt.edu', '01005550107', ['restaurant'], { outletId: 'outlet-a', affiliation: 'staff' }),
  user('u-tarek', 'Tarek Staff', 'tarek.staff@aucegypt.edu', '01005550108', ['restaurant'], { outletId: 'outlet-b', affiliation: 'staff' }),
  user('u-dina', 'Dina Staff', 'dina.staff@aucegypt.edu', '01005550109', ['restaurant'], { outletId: 'outlet-c', affiliation: 'staff' }),
  user('u-admin', 'Yara Admin', 'yara.admin@aucegypt.edu', '01005550110', ['admin'], { affiliation: 'staff' }),
  user('u-applicant', 'Farida Nabil', 'farida.alumni@example.com', '01005550111', ['customer'], {
    affiliation: 'alumni',
    appliedAt: now - 3 * HOUR,
    verification: { customer: 'pending', courier: 'none', idFileName: 'alumni-id.jpg', rejectReason: null },
  }),
  user('u-courier-applicant', 'Ziad Mostafa', 'ziad.demo@aucegypt.edu', '01005550112', ['customer'], {
    appliedAt: now - HOUR,
    verification: { customer: 'approved', courier: 'pending', idFileName: 'student-id.png', rejectReason: null },
    courierStats: stats(0, 100, 0, 0, null),
  }),
];

export function createSeed(now) {
  const outlets = createOutlets();
  const users = createUsers(now);
  const outletOf = (id) => outlets.find((o) => o.id === id);
  const handoffs = {};

  const deliveryRequest = (outletId, buildingId, floor, room, directions, fee, extra = {}) => {
    const building = getBuilding(buildingId);
    const minutes = walkingMinutes(getBuilding(outletOf(outletId).buildingId), building);
    return {
      status: DELIVERY_STATUS.OPEN,
      address: { pin: { x: building.x, y: building.y }, buildingId, buildingName: building.name, floor, room, directions },
      walkMinutes: minutes,
      suggestedFee: suggestDeliveryFee(minutes),
      fee,
      feePaid: false,
      feeMethod: null,
      courierId: null,
      bids: [],
      attempt: 0,
      postedAt: now - 4 * MINUTE,
      assignedAt: null,
      pickedUpAt: null,
      deliveredAt: null,
      settled: false,
      rating: null,
      ...extra,
    };
  };

  const order = (number, outletId, seq, status, customerId, lines, minutesAgo, extra = {}) => {
    const resolved = lines.map(([itemId, qty, choices = {}]) => resolveLine(outletOf(outletId), { itemId, qty, choices }));
    const id = `ord-${number}`;
    const source = customerId ? 'app' : 'walk_in';
    const placedAt = now - minutesAgo * MINUTE;
    if (source === 'app') {
      handoffs[`PU-${number}`] = { token: `PU-${number}`, orderId: id, stage: 'customer_pickup', authorizedUserId: customerId, usedAt: null };
    }
    return {
      id, outletId, seq, status, source, customerId,
      customerName: customerId ? users.find((u) => u.id === customerId).name : 'Walk-in customer',
      lines: resolved,
      placedAt,
      prepStartedAt: status === ORDER_STATUS.QUEUED ? null : now - (extra.prepAgo ?? 1) * MINUTE,
      readyAt: null,
      collectedAt: null,
      cancelledAt: null,
      payment: source === 'app' ? { method: 'card', amount: resolved.reduce((s, l) => s + l.unitPrice * l.qty, 0) } : null,
      wantsDelivery: Boolean(extra.delivery),
      delivery: null,
      ...extra,
    };
  };

  const pastDelivery = (outletId, buildingId, floor, room, fee, courierId, deliveredAgo, rating) =>
    deliveryRequest(outletId, buildingId, floor, room, 'Meet at the main entrance.', fee, {
      status: DELIVERY_STATUS.DELIVERED, courierId, feePaid: true, feeMethod: 'card', attempt: 1, settled: true,
      assignedAt: now - deliveredAgo - 20 * MINUTE, pickedUpAt: now - deliveredAgo - 10 * MINUTE, deliveredAt: now - deliveredAgo, rating,
    });

  const collected = (ago) => ({ readyAt: now - ago - 2 * MINUTE, collectedAt: now - ago });

  const orders = [
    // Outlet A: a shared FIFO line of app and walk-in orders
    order(2001, 'outlet-a', 101, ORDER_STATUS.PREPARING, null, [['latte', 1]], 6),
    order(2002, 'outlet-a', 102, ORDER_STATUS.QUEUED, 'u-omar', [['espresso', 3]], 5, {
      delivery: deliveryRequest('outlet-a', 'huss', '2', 'Room 2012', 'Second floor, by the stairs.', 20),
    }),
    order(2003, 'outlet-a', 103, ORDER_STATUS.QUEUED, null, [['croissant', 2]], 4),
    order(2004, 'outlet-a', 104, ORDER_STATUS.QUEUED, 'u-nour', [['espresso', 2]], 3, {
      delivery: deliveryRequest('outlet-a', 'waleed', '1', 'CP 40', 'Computer lab next to the lifts.', 20),
    }),
    order(2005, 'outlet-a', 105, ORDER_STATUS.QUEUED, null, [['latte', 1]], 2),

    // Outlet B: Salma's order has an open delivery request with courier bids
    order(2010, 'outlet-b', 201, ORDER_STATUS.PREPARING, 'u-salma', [['noodles', 1], ['iced-tea', 1]], 7, {
      delivery: deliveryRequest('outlet-b', 'sse', '1', 'Room 1140', 'Lab door facing the courtyard.', 20, {
        bids: [
          { id: 'bid-1', courierId: 'u-mariam', amount: 25, state: 'pending', at: now - 2 * MINUTE },
          { id: 'bid-2', courierId: 'u-hady', amount: 22, state: 'pending', at: now - MINUTE },
        ],
      }),
    }),
    order(2011, 'outlet-b', 202, ORDER_STATUS.QUEUED, 'u-omar', [['lotus-espresso', 1]], 3, {
      delivery: deliveryRequest('outlet-b', 'sse', '1', 'SSE 1140', 'Ask at the front desk.', 15),
    }),

    // Outlet C: Salma has exactly two orders ahead, so edits are locked
    order(2020, 'outlet-c', 301, ORDER_STATUS.PREPARING, null, [['hawawshi', 1]], 8, { prepAgo: 2 }),
    order(2021, 'outlet-c', 302, ORDER_STATUS.QUEUED, null, [['koshari', 1]], 5),
    order(2022, 'outlet-c', 303, ORDER_STATUS.QUEUED, 'u-salma', [['taameya', 2], ['karkade', 1]], 3),

    // History
    order(1001, 'outlet-c', 1, ORDER_STATUS.COLLECTED, 'u-salma', [['taameya', 2], ['hawawshi', 1]], 2 * 24 * 60, collected(2 * DAY - HOUR)),
    order(1002, 'outlet-a', 2, ORDER_STATUS.COLLECTED, 'u-salma', [['latte', 1], ['croissant', 1]], 4 * 24 * 60, {
      ...collected(4 * DAY - HOUR), delivery: pastDelivery('outlet-a', 'sse', '2', 'Room 2015', 18, 'u-karim', 4 * DAY - 30 * MINUTE, 5),
    }),
  ];

  const tx = (id, ownerId, type, amount, walletDelta, note, at, orderId = null, method = 'wallet') => ({
    id, ownerId, type, amount, walletDelta, note, at, orderId, method, state: 'simulated',
  });

  const transactions = [
    tx('tx-1', 'u-salma', 'credit', 150, 150, 'Launch promotion credit', now - 5 * DAY),
    tx('tx-2', 'u-salma', 'payment', 140, 0, 'Food order #1001', now - 2 * DAY, 'ord-1001', 'card'),
    tx('tx-3', 'u-salma', 'payment', 135, 0, 'Food order #1002', now - 4 * DAY, 'ord-1002', 'apple_pay'),
    tx('tx-4', 'u-salma', 'payment', 18, 0, 'Delivery fee #1002', now - 4 * DAY, 'ord-1002', 'card'),
    tx('tx-5', 'u-karim', 'earning', 17.1, 17.1, 'Delivery #1002: 95% of EGP 18', now - 4 * DAY, 'ord-1002'),
    tx('tx-6', 'platform', 'commission', 0.9, 0, 'Delivery #1002: 5% of EGP 18', now - 4 * DAY, 'ord-1002'),
    tx('tx-7', 'u-karim', 'earning', 95, 95, 'Earlier deliveries', now - 6 * DAY),
    tx('tx-8', 'u-mariam', 'earning', 40, 40, 'Earlier deliveries', now - 6 * DAY),
  ];

  return {
    version: STATE_VERSION,
    now,
    session: { userId: null, activeRole: null },
    users,
    outlets,
    orders,
    cart: { outletId: null, lines: [] },
    transactions,
    handoffs,
    notifications: [],
    supportCases: [
      {
        id: 'case-1',
        userId: 'u-nour',
        userName: 'Nour Amin',
        orderId: 'ord-2004',
        reason: 'Asked for a person to review a delivery fee dispute.',
        status: 'open',
        createdAt: now - 25 * MINUTE,
        transcript: [
          { from: 'user', text: 'I was charged twice for delivery on my order.' },
          { from: 'assistant', text: 'Refund disputes need a person to review them. I am sending this to the team.' },
        ],
        resolution: null,
      },
    ],
    counters: { order: 3000, seq: { 'outlet-a': 106, 'outlet-b': 203, 'outlet-c': 304, 'outlet-d': 401 }, id: 100 },
    demo: {
      paymentOutcome: 'success',
      outletsMode: 'normal',
      jobsMode: 'normal',
      camera: 'available',
      microphone: 'available',
      location: 'available',
      competingCourier: false,
    },
  };
}
