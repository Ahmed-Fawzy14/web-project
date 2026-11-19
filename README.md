# OtlobAUC

A campus food queue and student delivery platform for AUC. This is the Milestone 1 frontend. It covers the customer, courier, restaurant and admin journeys using fictional mock data, with no backend.

## Run it

1. Install Node.js 24 LTS and Git (`.nvmrc` selects Node 24).
2. Clone the repository and open the project folder.
3. Run `npm ci`.
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
| Runtime | Node.js | 24 LTS (verified locally with 24.19.0) |
| State updates | Immer | 11.2.10 |
| QR codes | qrcode.react | 4.2.0 |
| Icons | lucide-react | 1.75.0 |

Exact versions are pinned in `package.json` and `package-lock.json`.

## Netlify deployment

Import `aly0xx/web-project` from GitHub into Netlify, using the repository root
as the base directory and `main` as the production branch. The committed
`netlify.toml` sets Node 24, build command `npm run build`, and publish directory
`dist`. No environment variables or backend services are required for this demo.

The default build serves assets from `/`. Hash routes, such as `/#/orders`, work
with direct links and refreshes on static hosting without a rewrite rule.
For a manual Netlify upload, run `npm run build` and upload the **dist folder**.
Do not upload the source folder or run the Vite development server on Netlify.

## GitHub Pages deployment

The GitHub Pages target is https://aly0xx.github.io/web-project/.
Pushes to `main` automatically build and deploy through `.github/workflows/deploy.yml`.
The Pages workflow builds with `--base=/web-project/`, and hash routes (for example,
`/web-project/#/orders`) allow direct links and refreshes on GitHub Pages.
Local development and Netlify use `/`; only the Pages workflow uses `/web-project/`.
Enable GitHub Actions as the Pages source in repository settings before deploying.

## Browser tests and submission screenshots

```powershell
npm ci
npx playwright install chromium
npm run test:e2e
npm run test:report
```

Stop local Vite servers before `npm ci` on Windows so native build files are not
locked. The tests build the production frontend and start its preview server on
port 4173. Browser contexts use isolated fictional demo data. Tests check UI
feedback and persisted state, and fail on browser exceptions, console errors, or
failed HTTP responses. Backend tests remain Milestone 2 work.

Screenshots at 375, 768, and 1440 px and extra workflow evidence are saved in
`docs/evidence/screenshots/`. The dated run report is in
[docs/evidence/TEST-RESULTS.md](docs/evidence/TEST-RESULTS.md).
The interactive HTML report is generated in `playwright-report/` (not committed).

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
