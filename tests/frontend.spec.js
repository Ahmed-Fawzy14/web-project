import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const evidenceDir = path.resolve('docs/evidence/screenshots');
const state = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('otlobauc.demo-state')));
const go = (page, route) => page.goto(`/#${route}`);
const role = (page, name) => page.getByRole('group', { name: 'Demo role switcher' }).getByRole('button', { name, exact: true }).click();
const close = (page) => page.getByRole('button', { name: 'Close', exact: true }).click();

async function demoControl(page, label, value) {
  await page.getByRole('button', { name: 'Demo controls', exact: true }).click();
  await page.getByLabel(label, { exact: true }).selectOption(value);
  await close(page);
}

async function cart(page) {
  await role(page, 'Customer');
  await page.getByRole('link').filter({ hasText: 'Nile Bean Café' }).click();
  await page.getByRole('button', { name: 'Add Iced Latte', exact: true }).click();
  await page.getByRole('button', { name: /Add to cart/ }).click();
  await page.getByRole('link', { name: /Checkout/ }).click();
  await expect(page.getByRole('heading', { name: 'Checkout', exact: true })).toBeVisible();
}

async function shot(page, name) {
  await mkdir(evidenceDir, { recursive: true });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(evidenceDir, name), fullPage: true, animations: 'disabled' });
}

test.beforeEach(async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('response', (response) => { if (response.status() >= 400) errors.push(`HTTP ${response.status()} ${response.url()}`); });
  page.testErrors = errors;
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Sign in to OtlobAUC' })).toBeVisible();
});

test.afterEach(async ({ page }) => {
  expect(page.testErrors, 'No browser exceptions, console errors, or failed HTTP responses').toEqual([]);
});

test('T01 | role-aware navigation and direct-link refresh', async ({ page }) => {
  await role(page, 'Customer');
  for (const [label, heading] of [['My orders', 'My orders'], ['Wallet', 'Wallet'], ['Support', 'Support']]) {
    await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: label, exact: true }).click();
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
  }
  await role(page, 'Courier');
  await expect(page.getByRole('heading', { name: 'Orders available for pickup' })).toBeVisible();
  await role(page, 'Restaurant');
  await expect(page.getByRole('heading', { name: 'Nile Bean Café', exact: true })).toBeVisible();
  await role(page, 'Admin');
  await expect(page.getByRole('heading', { name: 'Admin dashboard' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Admin dashboard' })).toBeVisible();
});

test('T02 | registration rejects invalid input and preserves entered values', async ({ page }) => {
  await page.getByRole('link', { name: 'Create an account' }).click();
  await page.getByLabel('AUC email', { exact: true }).fill('fictional@example.com');
  await page.getByRole('button', { name: 'Submit for review' }).click();
  for (const text of ['Enter your full name.', 'Use your @aucegypt.edu email address.', 'Enter a contact phone number.', 'Use at least 8 characters.', 'Upload a photo or scan of your ID.']) {
    await expect(page.getByText(text, { exact: true })).toBeVisible();
  }
  await expect(page.getByLabel('AUC email', { exact: true })).toHaveValue('fictional@example.com');
  await shot(page, 'registration-validation-1440.png');
});

for (const width of [375, 768, 1440]) {
  test(`T03-${width} | checkout and order layout, mobile navigation, screenshots`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 375 ? 812 : 1000 });
    await role(page, 'Customer');
    await expect(page.getByRole('link').filter({ hasText: 'Nile Bean Café' })).toBeVisible();
    await shot(page, `outlets-${width}.png`);
    if (width === 375) {
      await page.getByRole('button', { name: 'Toggle navigation' }).click();
      await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'My orders' })).toBeVisible();
    }
    await cart(page);
    await expect(page.getByLabel('Contact phone', { exact: true })).toBeVisible();
    await shot(page, `checkout-${width}.png`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('button', { name: /Pay .* and join queue/ }).click();
    await expect(page.getByRole('heading', { name: 'Order #3001', exact: true })).toBeVisible();
    await expect(page.getByTestId('qr-token')).toHaveText('PU-3001');
    await shot(page, `order-${width}.png`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('button', { name: 'Edit order', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test('T04 | valid checkout creates exactly one paid order and survives refresh', async ({ page }) => {
  await cart(page);
  const before = await state(page);
  const pay = page.getByRole('button', { name: /Pay .* and join queue/ });
  // A burst of user clicks must not enqueue duplicate state transitions.
  await pay.evaluate((button) => { button.click(); button.click(); button.click(); });
  await expect(page.getByRole('heading', { name: 'Order #3001', exact: true })).toBeVisible();
  const after = await state(page);
  expect(after.orders).toHaveLength(before.orders.length + 1);
  expect(after.transactions).toHaveLength(before.transactions.length + 1);
  expect(after.cart.lines).toHaveLength(0);
  expect(after.orders.at(-1)).toMatchObject({ customerId: 'u-salma', status: 'queued', seq: 106 });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Order #3001', exact: true })).toBeVisible();
});

test('T05 | failed payment leaves cart, orders, and ledger unchanged', async ({ page }) => {
  await cart(page);
  await demoControl(page, 'Payments, refunds and withdrawals', 'fail');
  const before = await state(page);
  await page.getByRole('button', { name: /Pay .* and join queue/ }).click();
  await expect(page.getByRole('alert')).toContainText('declined');
  const after = await state(page);
  expect(after.orders).toEqual(before.orders);
  expect(after.transactions).toEqual(before.transactions);
  expect(after.cart).toEqual(before.cart);
  await shot(page, 'payment-error-1440.png');
});

test('T06 | staff Ready action advances the shared FIFO queue once', async ({ page }) => {
  await role(page, 'Restaurant');
  await expect(page.getByTestId('queue-list').locator('article').first()).toContainText('#2001');
  await page.getByRole('button', { name: 'Mark Ready', exact: true }).click();
  await expect(page.getByTestId('queue-list').locator('article').first()).toContainText('#2002');
  const after = await state(page);
  expect(after.orders.find((o) => o.id === 'ord-2001').status).toBe('ready');
  expect(after.orders.filter((o) => o.outletId === 'outlet-a' && o.status === 'preparing').map((o) => o.id)).toEqual(['ord-2002']);
  await shot(page, 'restaurant-queue-1440.png');
});

test('T07 | two-orders-ahead boundary blocks editing and cancellation', async ({ page }) => {
  await role(page, 'Customer');
  await go(page, '/orders/ord-2022');
  await expect(page.getByTestId('lock-reason')).toContainText('Only 2 orders are ahead');
  const before = await state(page);
  for (const name of ['Edit order', 'Cancel order']) {
    await page.getByRole('button', { name, exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('can no longer be edited or cancelled');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  }
  expect((await state(page)).orders).toEqual(before.orders);
});

test('T12 | assistant draft requires confirmation and creates one correct order', async ({ page }) => {
  await role(page, 'Customer');
  await go(page, '/support');
  const before = await state(page);
  await page.getByLabel('Message the assistant').fill('2 iced lattes from Outlet A');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.getByTestId('draft-card')).toContainText('Iced Latte');
  expect((await state(page)).orders).toEqual(before.orders);
  await shot(page, 'assistant-confirmation-1440.png');
  await page.getByRole('button', { name: /Confirm ·/ }).click();
  await expect(page.getByRole('link', { name: 'Track this order' })).toBeVisible();
  const order = (await state(page)).orders.at(-1);
  expect(order.lines).toEqual([expect.objectContaining({ itemId: 'iced-latte', qty: 2 })]);
});

test('T13 | assistant rejects unavailable items and quantities above maximum', async ({ page }) => {
  await role(page, 'Customer');
  await go(page, '/support');
  const before = await state(page);
  for (const message of ['11 iced lattes from Outlet A', '1 matcha from Outlet A']) {
    await page.getByLabel('Message the assistant').fill(message);
    await page.getByRole('button', { name: 'Send message' }).click();
    await expect(page.getByTestId('draft-card')).toHaveCount(0);
  }
  await expect(page.getByRole('log')).toContainText(/unavailable|not available/i);
  expect((await state(page)).orders).toEqual(before.orders);
});

test('T14 | ambiguous coffee clarifies and a discarded draft creates no order', async ({ page }) => {
  await role(page, 'Customer');
  await go(page, '/support');
  const before = await state(page);
  await page.getByLabel('Message the assistant').fill('a coffee');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.getByRole('log')).toContainText('Which one');
  await expect(page.getByTestId('draft-card')).toHaveCount(0);
  await page.getByLabel('Message the assistant').fill('2 iced lattes from Outlet A');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.getByTestId('draft-card')).toBeVisible();
  await page.getByRole('button', { name: 'Discard', exact: true }).click();
  await expect(page.getByRole('log')).toContainText('Nothing was placed or changed.');
  expect((await state(page)).orders).toEqual(before.orders);
});

test('T15 | English and Egyptian Arabic voice samples prepare matching drafts', async ({ page }) => {
  await role(page, 'Customer');
  await go(page, '/support');
  await page.getByRole('button', { name: 'English', exact: true }).click();
  const english = await page.getByTestId('draft-card').textContent();
  await page.getByRole('button', { name: 'Discard', exact: true }).click();
  await page.getByRole('button', { name: 'Egyptian Arabic', exact: true }).click();
  await expect(page.getByTestId('draft-card')).toHaveText(english);
  await shot(page, 'assistant-arabic-1440.png');
});

test('T16 | loading, empty and error states recover through demo controls', async ({ page }) => {
  await role(page, 'Customer');
  await demoControl(page, 'Outlet list', 'loading');
  await expect(page.getByText('Loading outlets…', { exact: true })).toBeVisible();
  await shot(page, 'outlets-loading-1440.png');
  await demoControl(page, 'Outlet list', 'empty');
  await expect(page.getByRole('heading', { name: 'No outlets are open' })).toBeVisible();
  await shot(page, 'outlets-empty-1440.png');
  await demoControl(page, 'Outlet list', 'error');
  await expect(page.getByRole('alert')).toContainText('could not load');
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.getByRole('link').filter({ hasText: 'Nile Bean Café' })).toBeVisible();
});

test('T17 | courier acceptance, one-job limit, and competitor conflict', async ({ page }) => {
  await role(page, 'Courier');
  await go(page, '/courier/jobs/ord-2002');
  await page.getByRole('button', { name: /^Accept EGP/ }).click();
  await expect(page.getByRole('heading', { name: 'Your pickup QR' })).toBeVisible();
  expect((await state(page)).orders.find((o) => o.id === 'ord-2002').delivery).toMatchObject({ courierId: 'u-karim', status: 'assigned' });
  await go(page, '/courier/jobs/ord-2004');
  await expect(page.getByRole('button', { name: /^Accept EGP/ })).toBeDisabled();
  await expect(page.getByRole('alert')).toContainText('Finish your active delivery');
  await go(page, '/courier/jobs/ord-2002');
  await page.getByRole('button', { name: 'Cancel this job', exact: true }).click();
  await expect.poll(async () => (await state(page)).orders.find((o) => o.id === 'ord-2002').delivery.status).toBe('courier_cancelled');
  await page.getByRole('button', { name: 'Demo controls', exact: true }).click();
  await page.getByLabel('Another courier wins the next job acceptance').check();
  await close(page);
  await go(page, '/courier/jobs/ord-2004');
  await page.getByRole('button', { name: /^Accept EGP/ }).click();
  await expect(page.getByRole('alert')).toContainText(/another courier/i);
  expect((await state(page)).orders.find((o) => o.id === 'ord-2004').delivery.courierId).not.toBe('u-karim');
});

test('T18 | complete courier handoff and 95/5 settlement, reject wrong/reused QR', async ({ page }) => {
  await role(page, 'Courier');
  await go(page, '/courier/jobs/ord-2002');
  await page.getByRole('button', { name: /^Accept EGP/ }).click();
  await expect(page.getByRole('heading', { name: 'Your pickup QR' })).toBeVisible();
  const assigned = (await state(page)).orders.find((o) => o.id === 'ord-2002');
  await role(page, 'Restaurant');
  await page.getByRole('button', { name: 'Mark Ready', exact: true }).click();
  await expect.poll(async () => (await state(page)).orders.find((o) => o.id === 'ord-2002').status).toBe('preparing');
  await page.getByRole('button', { name: 'Mark Ready', exact: true }).click();
  await page.getByRole('tab', { name: 'QR handoff' }).click();
  await page.getByLabel('QR code value').fill(assigned.delivery.deliveryToken);
  await page.getByRole('button', { name: 'Validate code', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('delivery code');
  await page.getByLabel('QR code value').fill(assigned.delivery.pickupToken);
  await page.getByRole('button', { name: 'Validate code', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'handed to Karim' })).toBeVisible();
  await page.getByLabel('QR code value').fill(assigned.delivery.pickupToken);
  await page.getByRole('button', { name: 'Validate code', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('already been used');
  await role(page, 'Courier');
  await go(page, '/courier/jobs/ord-2002');
  await page.getByLabel('QR code value').fill(assigned.delivery.deliveryToken);
  await page.getByRole('button', { name: 'Validate code', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Delivered.' })).toBeVisible();
  const after = await state(page);
  const settlement = after.transactions.filter((t) => t.orderId === 'ord-2002' && ['earning', 'commission'].includes(t.type));
  expect(settlement).toHaveLength(2);
  expect(settlement.find((t) => t.type === 'earning').amount).toBe(19);
  expect(settlement.find((t) => t.type === 'commission').amount).toBe(1);
  await shot(page, 'delivery-completed-1440.png');
});

test('T19 | editable order retains sequence after edit and refunds cancellation', async ({ page }) => {
  await cart(page);
  await page.getByRole('button', { name: /Pay .* and join queue/ }).click();
  await expect(page.getByRole('heading', { name: 'Order #3001', exact: true })).toBeVisible();
  const before = (await state(page)).orders.at(-1);
  await page.getByRole('button', { name: 'Edit order', exact: true }).click();
  await page.getByRole('button', { name: 'Add one Iced Latte', exact: true }).click();
  await page.getByRole('button', { name: /Pay .* and save/ }).click();
  await expect(page.getByRole('status').filter({ hasText: 'kept its place' })).toBeVisible();
  const edited = (await state(page)).orders.at(-1);
  expect(edited.seq).toBe(before.seq);
  expect(edited.lines[0].qty).toBe(2);
  await page.getByRole('button', { name: 'Cancel order', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm cancellation', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('This order was cancelled.');
  const after = await state(page);
  expect(after.transactions.filter((t) => t.orderId === edited.id && t.type === 'refund')).toEqual([expect.objectContaining({ amount: edited.payment.amount })]);
});

test('T20 | admin ID approval and assistant human escalation', async ({ page }) => {
  await role(page, 'Admin');
  await page.getByTestId('application-u-applicant').getByRole('button', { name: 'Approve', exact: true }).click();
  await expect(page.getByTestId('application-u-applicant')).toHaveCount(0);
  expect((await state(page)).users.find((u) => u.id === 'u-applicant').verification.customer).toBe('approved');
  await shot(page, 'admin-review-1440.png');
  await role(page, 'Customer');
  await go(page, '/support');
  await page.getByRole('button', { name: 'Talk to a person', exact: true }).click();
  await role(page, 'Admin');
  await page.getByRole('tab', { name: 'Support escalations' }).click();
  await expect(page.getByTestId('support-case').filter({ hasText: 'Salma Hassan' })).toBeVisible();
});

test('T21 | denied microphone and camera retain manual paths', async ({ page }) => {
  await role(page, 'Customer');
  await go(page, '/support');
  await demoControl(page, 'Microphone permission', 'denied');
  await page.getByRole('button', { name: 'English', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Type your request instead');
  await expect(page.getByLabel('Message the assistant')).toBeEnabled();
  await role(page, 'Restaurant');
  await demoControl(page, 'Camera permission', 'denied');
  await page.getByRole('tab', { name: 'QR handoff' }).click();
  await page.getByRole('button', { name: 'Open camera', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Camera access is unavailable' })).toBeVisible();
  await expect(page.getByLabel('QR code value')).toBeEnabled();
});

test('T22 | login rejection, valid login, role gate and ownership', async ({ page }) => {
  await page.getByLabel('Email', { exact: true }).fill('salma.demo@aucegypt.edu');
  await page.getByLabel('Password', { exact: true }).fill('incorrect');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('email or password is not correct');
  await page.getByLabel('Password', { exact: true }).fill('demo1234');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Hello, Salma.' })).toBeVisible();
  await go(page, '/admin');
  await expect(page.getByRole('heading', { name: 'You do not have access to this page' })).toBeVisible();
  await go(page, '/orders/ord-2002');
  await expect(page.getByRole('heading', { name: 'We could not find that page' })).toBeVisible();
});

test('T23 | keyboard focus and invalid checkout phone feedback', async ({ page }) => {
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();
  await expect(page.getByRole('heading', { name: 'Sign in to OtlobAUC' })).toBeVisible();
  await cart(page);
  await page.getByLabel('Contact phone', { exact: true }).fill('123');
  await page.getByRole('button', { name: /Pay .* and join queue/ }).click();
  await expect(page.getByText('Enter an Egyptian mobile number, like 01005550123.', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Contact phone', { exact: true })).toHaveValue('123');
  await expect(page.getByRole('heading', { name: 'Checkout', exact: true })).toBeVisible();
});

test('T24 | accepted counteroffer locks destination; cancellation pays agreed 95/5 fee', async ({ page }) => {
  await role(page, 'Customer');
  await go(page, '/orders/ord-2010/delivery');
  await page.locator('article').filter({ hasText: 'Mariam Fouad' }).getByRole('button', { name: 'Accept', exact: true }).click();
  await expect(page.getByText('The destination is locked now that a courier is assigned.', { exact: true })).toBeVisible();
  const assigned = (await state(page)).orders.find((o) => o.id === 'ord-2010');
  expect(assigned.delivery).toMatchObject({ status: 'assigned', courierId: 'u-mariam', fee: 25 });
  await shot(page, 'delivery-assigned-1440.png');
  await page.getByRole('button', { name: 'Cancel delivery', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm cancellation', exact: true }).click();
  await expect.poll(async () => (await state(page)).orders.find((o) => o.id === 'ord-2010').delivery.status).toBe('cancelled');
  const after = await state(page);
  expect(after.orders.find((o) => o.id === 'ord-2010').status).toBe('preparing');
  const tx = after.transactions.filter((t) => t.orderId === 'ord-2010');
  expect(tx.find((t) => t.type === 'cancellation_compensation').amount).toBe(23.75);
  expect(tx.find((t) => t.type === 'commission').amount).toBe(1.25);
});

test('T25 | valid registration stays pending until admin approval', async ({ page }) => {
  await page.getByRole('link', { name: 'Create an account' }).click();
  await page.getByLabel('Full name', { exact: true }).fill('Fictional Test Student');
  await page.getByLabel('AUC email', { exact: true }).fill('fictional.test@aucegypt.edu');
  await page.getByLabel('Contact phone', { exact: true }).fill('01005550999');
  await page.getByLabel('Password', { exact: true }).fill('madeup-demo-pass');
  await page.getByLabel('Confirm password', { exact: true }).fill('madeup-demo-pass');
  await page.getByLabel('AUC ID', { exact: true }).setInputFiles({ name: 'fictional-test-id.png', mimeType: 'image/png', buffer: Buffer.from('fictional fixture; only filename is stored') });
  await page.getByRole('button', { name: 'Submit for review' }).click();
  await expect(page).toHaveURL(/#\/account-status/);
  const user = (await state(page)).users.find((u) => u.email === 'fictional.test@aucegypt.edu');
  expect(user.verification.customer).toBe('pending');
  await go(page, '/');
  await expect(page).toHaveURL(/#\/account-status/);
  await role(page, 'Admin');
  await page.getByTestId(`application-${user.id}`).getByRole('button', { name: 'Approve', exact: true }).click();
  await expect(page.getByTestId(`application-${user.id}`)).toHaveCount(0);
  expect((await state(page)).users.find((u) => u.id === user.id).verification.customer).toBe('approved');
});

test('T26 | courier empty jobs and withdrawal validation/success', async ({ page }) => {
  await role(page, 'Courier');
  await expect(page.getByRole('link', { name: /View job|Open job/i }).first()).toBeVisible();
  await shot(page, 'courier-jobs-1440.png');
  await demoControl(page, 'Courier job list', 'empty');
  await expect(page.getByRole('heading', { name: 'No jobs right now' })).toBeVisible();
  await go(page, '/wallet');
  await page.getByLabel('Amount (EGP)', { exact: true }).fill('999');
  await page.getByRole('button', { name: 'Withdraw', exact: true }).click();
  await expect(page.getByText('You cannot withdraw more than your balance.', { exact: true })).toBeVisible();
  await page.getByLabel('Amount (EGP)', { exact: true }).fill('10');
  await page.getByRole('button', { name: 'Withdraw', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Withdrawal of EGP 10 requested.' })).toBeVisible();
  await shot(page, 'courier-wallet-1440.png');
});
