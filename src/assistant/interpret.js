import { orderNumber } from '../domain/format';
import {
  defaultChoices,
  editLock,
  estimateMinutes,
  isActiveOrder,
  linesTotal,
  MAX_QUANTITY,
  orderPrepMinutes,
  ordersAhead,
  outletWaitMinutes,
  resolveLine,
} from '../domain/orders';

/**
 * Simulated AI agent: a deterministic, rule-based stand-in for the LLM in
 * Milestone 1. It follows the flow in Figure 4.1: parse, validate, then ask for
 * confirmation. It never changes state itself.
 */
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

export function normalize(text) {
  return text
    .toLowerCase()
    .replace(/[٠-٩]/g, (d) => ARABIC_DIGITS.indexOf(d))
    .replace(/[ً-ْ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/(\d+)\s*x\b/g, '$1 ')
    .replace(/[^\p{L}\p{N}\s']/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const QUANTITY_WORDS = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
  واحد: 1, واحده: 1, اتنين: 2, تلاته: 3, اربعه: 4, خمسه: 5, سته: 6,
};
const QUANTITY = `\\d+|${Object.keys(QUANTITY_WORDS).join('|')}`;
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const toQuantity = (raw) => (raw ? Number(raw) || QUANTITY_WORDS[raw] : 1);

const PATTERNS = {
  human: /\b(human|person|agent|someone|representative)\b|موظف|اكلم حد|بني ادم/,
  cancel: /\bcancel\b|الغي|الغاء|كنسل/,
  status: /\b(status|track|where is my|where's my)\b|طلبي فين|فين طلبي|الاوردر فين|فين الاوردر|حاله الطلب/,
  edit: /\b(edit|change my|modify)\b|عدل|تعديل/,
  delivery: /\b(deliver|delivery)\b|توصيل|وصل/,
  refund: /\brefund|استرجاع|فلوسي/,
  fee: /\b(fee|commission|bid|counteroffer)\b|رسوم|عموله/,
  qr: /\bqr\b|كود/,
  wallet: /\bwallet|withdraw|محفظه/,
};

const GENERIC_COFFEE = /(?:^|\s)(?:(\d+|a|an|one|two|three|واحد|اتنين|تلاته)\s+)?(coffee|coffees|قهوه)(?=\s|$)/;

const text = (arabic, en, ar) => (arabic ? ar : en);

function findMentions(message, outlets) {
  const aliases = new Map();
  outlets.forEach((outlet) => {
    outlet.menu.forEach((item) => {
      item.aliases.forEach((alias) => {
        const key = normalize(alias);
        aliases.set(key, [...(aliases.get(key) ?? []), { outlet, item }]);
      });
    });
  });

  let remaining = ` ${message} `;
  const mentions = [];
  [...aliases.keys()].sort((a, b) => b.length - a.length).forEach((alias) => {
    const pattern = new RegExp(`(\\s)و?(?:(${QUANTITY})\\s+)?و?${escapeRegex(alias)}(?:es|s)?(?=\\s)`, 'g');
    remaining = remaining.replace(pattern, (_match, space, qty) => {
      mentions.push({ alias, qty: toQuantity(qty), candidates: aliases.get(alias) });
      return `${space}§`;
    });
  });
  return mentions;
}

const namedOutlets = (message, outlets) =>
  outlets.filter((outlet) => outlet.aliases.some((alias) => ` ${message} `.includes(` ${normalize(alias)} `)));

function chosenOptions(item, message) {
  const choices = defaultChoices(item);
  (item.options ?? []).forEach((group) => {
    const match = group.choices.find((c) => c.aliases?.some((a) => ` ${message} `.includes(` ${normalize(a)} `)));
    if (match) choices[group.id] = match.id;
  });
  return choices;
}

function interpretOrder(message, arabic, state) {
  const { outlets, orders, now } = state;
  const named = namedOutlets(message, outlets);
  if (named.length > 1) {
    return {
      kind: 'text',
      text: text(arabic, 'Each order can only come from one outlet. Please choose one and try again.', 'كل طلب لازم يكون من منفذ واحد. اختار منفذ واحد وجرب تاني.'),
    };
  }

  const mentions = findMentions(message, outlets);
  if (mentions.length === 0) {
    const generic = message.match(GENERIC_COFFEE);
    if (!generic) return null;
    if (named[0]) {
      const drinks = named[0].menu.filter((i) => i.category === 'Coffee' || i.name === 'Espresso').map((i) => i.name).join(', ');
      return {
        kind: 'clarify',
        pendingText: message,
        text: text(arabic, `Which coffee from ${named[0].name}? Options: ${drinks}.`, `تحب انهي قهوة من ${named[0].name}؟ الاختيارات: ${drinks}.`),
      };
    }
    const places = outlets.filter((o) => o.open && o.menu.some((i) => i.aliases.some((a) => /espresso|latte/.test(a)))).map((o) => `${o.code} (${o.name})`).join(', ');
    return {
      kind: 'clarify',
      pendingText: message,
      text: text(arabic, `Several outlets serve coffee. Which one would you like: ${places}?`, `فيه اكتر من منفذ بيقدم قهوة. تحب انهي واحد: ${places}؟`),
    };
  }

  let outletIds = named[0] ? [named[0].id] : null;
  for (const mention of mentions) {
    const here = mention.candidates.map((c) => c.outlet.id);
    if (named[0] && !here.includes(named[0].id)) {
      return {
        kind: 'text',
        text: text(arabic, `${named[0].name} does not sell "${mention.alias}". Nothing was added.`, `${named[0].name} مش بيبيع "${mention.alias}". ماتضافش حاجة.`),
      };
    }
    outletIds = outletIds ? outletIds.filter((id) => here.includes(id)) : here;
  }
  outletIds = [...new Set(outletIds)];

  if (outletIds.length === 0) {
    return {
      kind: 'text',
      text: text(arabic, 'Those items come from different outlets, and each order can only come from one outlet. Nothing was added.', 'الاصناف دي من منافذ مختلفة، وكل طلب لازم يكون من منفذ واحد. ماتضافش حاجة.'),
    };
  }
  if (outletIds.length > 1) {
    const places = outletIds.map((id) => outlets.find((o) => o.id === id)).map((o) => `${o.code} (${o.name})`).join(', ');
    return {
      kind: 'clarify',
      pendingText: message,
      text: text(arabic, `That is available at more than one outlet. Which one: ${places}?`, `الصنف ده موجود في اكتر من منفذ. تحب انهي واحد: ${places}؟`),
    };
  }

  const outlet = outlets.find((o) => o.id === outletIds[0]);
  if (!outlet.open) {
    return { kind: 'text', text: text(arabic, `${outlet.name} is closed right now. Nothing was added.`, `${outlet.name} مقفول دلوقتي. ماتضافش حاجة.`) };
  }

  const rawLines = [];
  for (const mention of mentions) {
    const { item } = mention.candidates.find((c) => c.outlet.id === outlet.id);
    if (!item.available) {
      return { kind: 'text', text: text(arabic, `${item.name} is unavailable right now. Nothing was added.`, `${item.name} مش متاح دلوقتي. ماتضافش حاجة.`) };
    }
    if (!Number.isInteger(mention.qty) || mention.qty < 1 || mention.qty > MAX_QUANTITY) {
      return {
        kind: 'text',
        text: text(arabic, `You can order between 1 and ${MAX_QUANTITY} of ${item.name}. Nothing was added.`, `تقدر تطلب من 1 لـ ${MAX_QUANTITY} من ${item.name}. ماتضافش حاجة.`),
      };
    }
    rawLines.push({ itemId: item.id, qty: mention.qty, choices: chosenOptions(item, message) });
  }

  const lines = rawLines.map((line) => resolveLine(outlet, line));
  return {
    kind: 'draft',
    text: text(arabic, 'Here is your draft order. Nothing is placed until you confirm.', 'ده طلبك المبدئي. مفيش حاجة هتتنفذ غير لما تأكد.'),
    draft: {
      outletId: outlet.id,
      outletName: outlet.name,
      lines: rawLines,
      resolved: lines,
      total: linesTotal(lines),
      waitMinutes: Math.ceil(outletWaitMinutes(outlet.id, orders, now) + orderPrepMinutes(lines)),
    },
  };
}

export function interpret(rawMessage, { state, user, pendingText }) {
  const arabic = /[؀-ۿ]/.test(rawMessage);
  const message = normalize(rawMessage);
  const myOrders = state.orders
    .filter((o) => o.customerId === user.id && isActiveOrder(o))
    .sort((a, b) => b.placedAt - a.placedAt);
  const latest = myOrders[0];

  if (pendingText && /^(no|nope|never ?mind|stop|لا|خلاص)$/.test(message)) {
    return { kind: 'text', text: text(arabic, 'Okay, nothing was placed.', 'تمام، مفيش حاجة اتنفذت.') };
  }

  if (PATTERNS.human.test(message)) {
    return {
      kind: 'escalate',
      reason: 'Customer asked for a person.',
      text: text(arabic, 'I have sent this conversation to the support team. A person will review it.', 'بعت المحادثة دي لفريق الدعم، وحد هيراجعها.'),
    };
  }

  if (PATTERNS.cancel.test(message)) {
    if (!latest) return { kind: 'text', text: text(arabic, 'You have no active order to cancel.', 'مفيش طلب حالي تلغيه.') };
    const lock = editLock(latest, state.orders);
    if (!lock.allowed) {
      return { kind: 'text', text: text(arabic, `I cannot cancel order ${orderNumber(latest.id)}. ${lock.reason}`, `مش هقدر الغي الطلب ${orderNumber(latest.id)} لان التعديل والالغاء اتقفلوا.`) };
    }
    return {
      kind: 'confirm_cancel',
      orderId: latest.id,
      text: text(arabic, `Cancel order ${orderNumber(latest.id)} and refund it to your original payment method?`, `تحب تلغي الطلب ${orderNumber(latest.id)} وترجع الفلوس لطريقة الدفع الاصلية؟`),
    };
  }

  if (PATTERNS.status.test(message)) {
    if (!latest) return { kind: 'text', text: text(arabic, 'You have no active order right now.', 'مفيش طلب حالي دلوقتي.') };
    const ahead = ordersAhead(latest, state.orders).length;
    const minutes = estimateMinutes(latest, state.orders, state.now);
    return {
      kind: 'text',
      link: { to: `/orders/${latest.id}`, label: `Open order ${orderNumber(latest.id)}` },
      text: text(arabic, `Order ${orderNumber(latest.id)} is ${latest.status}. ${ahead} ahead of you, about ${minutes} min (estimate).`, `الطلب ${orderNumber(latest.id)} حالته ${latest.status}. قدامك ${ahead} طلبات، حوالي ${minutes} دقيقة (تقديري).`),
    };
  }

  if (PATTERNS.edit.test(message)) {
    if (!latest) return { kind: 'text', text: text(arabic, 'You have no active order to edit.', 'مفيش طلب حالي تعدله.') };
    const lock = editLock(latest, state.orders);
    return {
      kind: 'text',
      link: lock.allowed ? { to: `/orders/${latest.id}`, label: 'Edit this order' } : undefined,
      text: lock.allowed
        ? text(arabic, 'You can still edit this order. Open it to review the changes and confirm them.', 'لسه تقدر تعدل الطلب. افتحه وراجع التعديلات وأكدها.')
        : text(arabic, lock.reason, 'التعديل اتقفل للطلب ده.'),
    };
  }

  const combined = pendingText ? `${pendingText} ${message}` : message;
  const order = interpretOrder(combined, arabic, state);
  if (order) return order;

  if (PATTERNS.delivery.test(message)) {
    return {
      kind: 'text',
      link: latest ? { to: `/orders/${latest.id}/delivery`, label: 'Arrange delivery' } : undefined,
      text: text(arabic, 'Choose your campus location and offer a fee. A verified student courier can accept it or counteroffer.', 'اختار مكانك في الحرم الجامعي واعرض رسوم التوصيل، والمندوب يقبل او يقدم عرض تاني.'),
    };
  }
  if (PATTERNS.refund.test(message)) {
    return { kind: 'text', text: text(arabic, 'Eligible cancellations and price decreases go back to your original payment method or wallet, your choice. Disputes need a person to review them.', 'الالغاء المسموح وفرق السعر بيرجعوا لطريقة الدفع الاصلية او المحفظة حسب اختيارك. النزاعات لازم يراجعها موظف.') };
  }
  if (PATTERNS.fee.test(message)) {
    return { kind: 'text', text: text(arabic, 'You offer a delivery fee and couriers accept it or counteroffer. Couriers receive 95% and the platform keeps 5%.', 'انت بتعرض رسوم التوصيل والمندوب يقبل او يقدم عرض تاني. المندوب بياخد 95% والمنصة 5%.') };
  }
  if (PATTERNS.qr.test(message)) {
    return { kind: 'text', text: text(arabic, 'Show your order QR at the outlet for pickup. For delivery, your courier scans your delivery QR at handoff.', 'وري كود الطلب في المنفذ عند الاستلام. في التوصيل، المندوب بيعمل مسح لكود التسليم بتاعك.') };
  }
  if (PATTERNS.wallet.test(message)) {
    return { kind: 'text', link: { to: '/wallet', label: 'Open wallet' }, text: text(arabic, 'Your wallet holds credit and refunds, and can pay for food and delivery.', 'المحفظة فيها الرصيد والمرتجعات، وتقدر تدفع بيها الاكل والتوصيل.') };
  }

  return {
    kind: 'text',
    text: text(arabic, 'I did not catch that. Try "2 iced lattes and a croissant from Outlet A", "where is my order", or ask for a person.', 'مفهمتش قصدك. جرب "عايز 2 لاتيه مثلج وكرواسون من منفذ أ" او "طلبي فين" او اطلب تكلم موظف.'),
  };
}
