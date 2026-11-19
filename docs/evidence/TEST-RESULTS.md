# Milestone 1 frontend test evidence

Run: 2026-11-19T19:48:07.305Z (UTC), 19 November 2026.

Chromium 159.0.8154.6; Playwright 1.65.1; Node v24.19.0; Windows. Production build served locally at http://127.0.0.1:4173/. Each test starts in an isolated context with fictional seed data.

**24 passed, 0 failed, 0 skipped, 0 flaky.** Browser run: 48.0 seconds. All tests also assert no browser exceptions, console errors, or HTTP responses with status 400 or higher.

## Reproduce

```powershell
npm ci
npx playwright install chromium
npm run test:e2e
npm run test:report
```

The executable scenarios are in [frontend.spec.js](../../tests/frontend.spec.js). Each result below has the same fresh-context precondition. Source fingerprint (SHA-256 of source, dependency files, config and tests): `d5e0a5e16b19922dedd46fe0fe0c232e5ea05aa4cd6c82ca7895f7a2f69765e9`. Detailed timings and observed results: [results.json](results.json).

## Test cases and actual results

| ID | Requirement | Steps / input | Expected and observed result | Status |
| --- | --- | --- | --- | --- |
| T01 | Routes / AC-07 | Use navigation for all four roles; refresh admin route. | Correct views load and the direct link survives refresh. | PASSED |
| T02 | FR-01 | Submit incomplete registration with a personal email as a student. | Specific name/email/phone/password/ID errors; entered email preserved. | PASSED |
| T03-375 | NFR-01 / AC-07 | At the named width, browse, checkout, pay, view order, open edit dialog. | Usable controls, pickup QR, no horizontal page overflow; screenshots captured. | PASSED |
| T03-768 | NFR-01 / AC-07 | At the named width, browse, checkout, pay, view order, open edit dialog. | Usable controls, pickup QR, no horizontal page overflow; screenshots captured. | PASSED |
| T03-1440 | NFR-01 / AC-07 | At the named width, browse, checkout, pay, view order, open edit dialog. | Usable controls, pickup QR, no horizontal page overflow; screenshots captured. | PASSED |
| T04 | FR-02 / AC-01 | Add an iced latte, burst-click Pay, reload order. | Exactly one paid queued order, one ledger entry, empty cart, persisted order. | PASSED |
| T05 | FR-02 / AC-01 | Force payment failure at checkout and submit. | Decline feedback; orders, transactions, and cart remain unchanged. | PASSED |
| T06 | FR-03 / AC-02 | Staff marks #2001 Ready in the mixed app/walk-in queue. | #2001 Ready, #2002 Preparing, exactly one preparing order for the outlet. | PASSED |
| T07 | FR-05 / AC-02 | Open #2022 with exactly two orders ahead; try edit and cancel. | Both actions blocked with a clear reason; orders unchanged. | PASSED |
| T12 | FR-14 / advanced normal | Request 2 iced lattes from Outlet A, inspect draft, then confirm. | No order before confirmation; correct item and quantity in the resulting order. | PASSED |
| T13 | Advanced boundary | Request 11 iced lattes and unavailable matcha from Outlet A. | No draft/order created; unavailable-item feedback displayed. | PASSED |
| T14 | Advanced ambiguity/failure | Ask for a coffee, clarify with a named item/outlet, discard draft. | Clarification requested; discard creates no order. | PASSED |
| T15 | FR-15 / AC-06 | Use English and Egyptian Arabic sample voice buttons. | Both produce identical correct draft contents; no real speech service used. | PASSED |
| T16 | NFR-03 / AC-07 | Force loading, empty, and error outlet states; retry. | Each state is visible; retry restores the outlet list. | PASSED |
| T17 | FR-07 / AC-03 | Accept a courier job, try a second, cancel, simulate another courier winning. | First job assigned; busy courier blocked; competitor receives the next assignment. | PASSED |
| T18 | FR-09/11 / AC-04 | Accept #2002, advance kitchen, submit wrong-stage and reused pickup codes, deliver. | Wrong/reused codes rejected; delivery completes with one EGP 19 earning and EGP 1 commission. | PASSED |
| T19 | FR-05 / AC-02/05 | Create order, increase quantity and pay difference, then cancel food. | Sequence retained, quantity updated, full edited food value refunded once. | PASSED |
| T20 | FR-01/14 / AC-06 | Approve seeded ID application; customer asks for a person; open admin support. | Verification becomes approved and Salma’s escalation appears for admin. | PASSED |
| T21 | NFR-03 | Deny microphone/camera; use voice sample and open camera. | Useful permission feedback; typed assistant and QR input remain enabled. | PASSED |
| T22 | FR-01 / client access | Wrong password, correct password, customer admin route, another customer’s order. | Login error then success; admin denied and non-owned order hidden. Client simulation only. | PASSED |
| T23 | NFR-02 / validation | Tab to skip link and activate; enter 123 as checkout phone. | Focus enters main without route change; invalid phone preserved with feedback. | PASSED |
| T24 | FR-07/10 / AC-03/05 | Accept Mariam’s EGP 25 bid on #2010, cancel delivery only. | Destination locks; food continues; EGP 23.75 compensation and EGP 1.25 commission. | PASSED |
| T25 | FR-01 / AC-06 | Submit valid fictional registration; try outlets before admin approval; approve. | Account stays pending and gated until approval; only ID filename is retained by app. | PASSED |
| T26 | FR-11 / NFR-03 | Show empty jobs; try over-balance withdrawal, then withdraw EGP 10. | Empty state and validation shown; simulated withdrawal succeeds. | PASSED |

## Scope and deferred checks

T08–T11 in the SDD require a live backend (persistent API data, HTTP validation/status codes, server authentication, server ownership enforcement). They are deferred to Milestone 2 and are not counted as passes or skipped Playwright tests. T22 exercises browser simulation only. Real payment, speech, GPS, camera scanning and production identity verification are not tested because the demo does not implement them.

AC-01 through AC-07 have frontend evidence across T04/T05/T23, T06/T07/T19, T17/T24, T18, T19/T24, T15/T20/T25, and T01/T03/T16 respectively. This is representative journey coverage, not exhaustive accessibility or multi-browser certification.

## Defects fixed during verification

- Mobile checkout summary inherited a desktop top offset, leaving a gap and overlapping the footer. Restricted the offset to the desktop breakpoint; recaptured the mobile/tablet screenshots.
- The skip-to-content anchor conflicted with hash routing. It now focuses a focusable main element without changing route; T23 verifies keyboard activation.
- Netlify builds inherited GitHub Pages’ repository subpath. Default builds now use root assets; the Pages workflow alone specifies /web-project/.

## Screenshots

Full-page captures use a 375 × 812 mobile viewport and 768 × 1000 / 1440 × 1000 tablet/desktop viewports; document height varies. The required checkout, order, and outlet screenshots cover all three widths. Additional captures document validation, loading/empty/error states, assistant drafts, courier and restaurant workflows, and admin review.

- [admin-review-1440.png](screenshots/admin-review-1440.png)
- [assistant-arabic-1440.png](screenshots/assistant-arabic-1440.png)
- [assistant-confirmation-1440.png](screenshots/assistant-confirmation-1440.png)
- [checkout-1440.png](screenshots/checkout-1440.png)
- [checkout-375.png](screenshots/checkout-375.png)
- [checkout-768.png](screenshots/checkout-768.png)
- [courier-jobs-1440.png](screenshots/courier-jobs-1440.png)
- [courier-wallet-1440.png](screenshots/courier-wallet-1440.png)
- [delivery-assigned-1440.png](screenshots/delivery-assigned-1440.png)
- [delivery-completed-1440.png](screenshots/delivery-completed-1440.png)
- [order-1440.png](screenshots/order-1440.png)
- [order-375.png](screenshots/order-375.png)
- [order-768.png](screenshots/order-768.png)
- [outlets-1440.png](screenshots/outlets-1440.png)
- [outlets-375.png](screenshots/outlets-375.png)
- [outlets-768.png](screenshots/outlets-768.png)
- [outlets-empty-1440.png](screenshots/outlets-empty-1440.png)
- [outlets-loading-1440.png](screenshots/outlets-loading-1440.png)
- [payment-error-1440.png](screenshots/payment-error-1440.png)
- [registration-validation-1440.png](screenshots/registration-validation-1440.png)
- [restaurant-queue-1440.png](screenshots/restaurant-queue-1440.png)
