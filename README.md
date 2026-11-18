# OtlobAUC

A campus food queue and student delivery platform for AUC. This is the Milestone 1 frontend. It covers the customer, courier, restaurant and admin journeys using fictional mock data, with no backend.

## Run it

1. Install Node.js 26.12.0 and Git.
2. Clone the repository and open the project folder.
3. Run `npm install`.
4. Run `npm run dev`, then open the local URL it prints, normally http://localhost:5173.

Use the **Demo role** bar at the top to switch roles, or sign in on the login page. Every demo account uses the password `demo1234`.

| Role | Email |
| --- | --- |
| Customer | `salma.demo@aucegypt.edu` |
| Courier and customer | `karim.demo@aucegypt.edu` |
| Staff, Nile Bean Café | `lina.staff@aucegypt.edu` |
| Staff, Lotus Wok | `tarek.staff@aucegypt.edu` |
| Staff, Baladi Corner | `dina.staff@aucegypt.edu` |
| Admin | `yara.admin@aucegypt.edu` |

**Demo controls**, also in the top bar, force payment failures, loading, empty and error states, denied camera, microphone or location permissions, and a competing courier.

## Stack

| Layer | Technology | Version |
| --- | --- | --- |
| Frontend | React | 19.3.1 |
| Routing | React Router | 7.18.6 |
| CSS framework | Bootstrap | 5.3.9 |
| Build tool | Vite | 8.3.8 |
| Runtime | Node.js | 26.12.0 |
| State updates | Immer | 11.2.10 |
| QR codes | qrcode.react | 4.2.0 |
| Icons | lucide-react | 1.75.0 |

Exact versions are pinned in `package.json` and `package-lock.json`.

## Persistence and reset

Demo state is saved in this browser's `localStorage`, so it survives a refresh. **Demo controls > Reset all demo data** restores the original data and signs you out. Uploaded ID files are never stored, only their file names.

## Simulated services

Nothing below connects to a live service, and each is labeled in the interface.

| Service | Milestone 1 behavior |
| --- | --- |
| Card, Apple Pay, wallet settlement, refunds, withdrawals | Mock results, controlled from Demo controls |
| ID verification | Reviewed by hand in the admin view |
| AI assistant | Deterministic rule-based parser in `src/assistant/interpret.js` |
| Voice | Sample phrases stand in for speech recognition |
| Campus map and courier location | Schematic map with demo movement |
| QR scanning | **Camera scanning is simulated.** Codes are typed or picked, then validated against the order, participant and stage |

## Project structure

| Path | Purpose |
| --- | --- |
| `src/data` | Fictional outlets, users, orders and campus map |
| `src/domain` | Queue, wait-time, edit-lock and validation rules |
| `src/store/api.js` | Mock backend. Milestone 2 replaces these commands with API calls |
| `src/assistant` | Simulated AI ordering agent |
| `src/components` | Reusable UI |
| `src/pages` | Route views for each role |
| `src/styles/theme.css` | Bootstrap theme and brand colors |

See [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md) for how each requirement is covered.
