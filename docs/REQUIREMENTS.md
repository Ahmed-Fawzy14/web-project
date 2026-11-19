# Requirements coverage

Status of each item in `public/AUC delivery & digital queue website.pdf` for Milestone 1.

**Met** means it works in the demo. **Simulated** means the journey works with a labeled mock in place of the external service, as the document allows. **Milestone 2** means it needs the backend.

## Functional requirements

| ID | Requirement | Status | Where to see it |
| --- | --- | --- | --- |
| FR-01 | Accounts and roles | Simulated | `/register`, `/courier/register`, `/admin` |
| FR-02 | Menus and checkout | Simulated payment | `/outlets/:id`, `/checkout` |
| FR-03 | Shared FIFO queue | Met | `/orders/:id`, `/restaurant` |
| FR-04 | Waiting-time estimate | Met | Outlet cards, `/orders/:id` |
| FR-05 | Editing and food cancellation | Simulated payment | `/orders/:id` |
| FR-06 | Delivery requests | Simulated map | `/orders/:id/delivery` |
| FR-07 | Bidding and assignment | Met | `/courier/jobs/:id`, `/orders/:id/delivery` |
| FR-08 | Tracking and calls | Simulated location | `/orders/:id/delivery` |
| FR-09 | QR handoffs | Simulated camera | Restaurant QR handoff tab, `/courier/jobs/:id` |
| FR-10 | Delivery cancellations | Met | `/orders/:id/delivery`, `/courier/jobs/:id` |
| FR-11 | Wallet and earnings | Simulated settlement | `/wallet` |
| FR-12 | Reliability | Met, formula still open | Courier bids |
| FR-13 | Restaurant dashboard | Met | `/restaurant` |
| FR-14 | AI support and escalation | Simulated AI | `/support`, `/admin` |
| FR-15 | Customer voice actions | Simulated voice | `/support` |
| FR-16 | In-app notifications | Met | Bell icon |

## Acceptance scenarios and test cases

| ID | Result |
| --- | --- |
| AC-01 to AC-07 | Representative frontend coverage in the dated Playwright evidence |
| T01 to T07 | Passed with Playwright on 19 November 2026; T03 checked at all three widths |
| T08 to T11 | Milestone 2, these need the backend |
| T12 to T14 | Passed with Playwright on 19 November 2026 |

See [the test report](evidence/TEST-RESULTS.md) for all 24 executed scenarios,
actual results, test conditions, known limits, and 21 submission screenshots.

## Known limits

- Role checks run in the browser. Milestone 2 must enforce them on the server.
- The assistant understands the demo menu and common phrases, not free-form language.
- By chat or voice, ordering, status, cancellation and escalation work directly. Edits and delivery link to the normal screens.
- Refund exceptions go to admin review, because the document leaves that policy open.
- Fee amounts, distance brackets, the reliability formula and withdrawal timing are placeholders, because the document leaves them undecided.

## Changes from the original wireframe

The requirements document takes priority over the wireframe where they differ.

| Wireframe | Now |
| --- | --- |
| Real restaurant names | Fictional outlets, as the document requires |
| Cash or card | Card, Apple Pay or wallet |
| Fixed delivery fee | Customer offer with courier counteroffers |
| Building and room only | Map pin, building, floor, room and directions |
