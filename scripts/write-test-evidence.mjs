import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const report = JSON.parse(await readFile('test-results/results.json', 'utf8'));
const details = {
  T01: ['Routes / AC-07', 'Use navigation for all four roles; refresh admin route.', 'Correct views load and the direct link survives refresh.'],
  T02: ['FR-01', 'Submit incomplete registration with a personal email as a student.', 'Specific name/email/phone/password/ID errors; entered email preserved.'],
  T03: ['NFR-01 / AC-07', 'At the named width, browse, checkout, pay, view order, open edit dialog.', 'Usable controls, pickup QR, no horizontal page overflow; screenshots captured.'],
  T04: ['FR-02 / AC-01', 'Add an iced latte, burst-click Pay, reload order.', 'Exactly one paid queued order, one ledger entry, empty cart, persisted order.'],
  T05: ['FR-02 / AC-01', 'Force payment failure at checkout and submit.', 'Decline feedback; orders, transactions, and cart remain unchanged.'],
  T06: ['FR-03 / AC-02', 'Staff marks #2001 Ready in the mixed app/walk-in queue.', '#2001 Ready, #2002 Preparing, exactly one preparing order for the outlet.'],
  T07: ['FR-05 / AC-02', 'Open #2022 with exactly two orders ahead; try edit and cancel.', 'Both actions blocked with a clear reason; orders unchanged.'],
  T12: ['FR-14 / advanced normal', 'Request 2 iced lattes from Outlet A, inspect draft, then confirm.', 'No order before confirmation; correct item and quantity in the resulting order.'],
  T13: ['Advanced boundary', 'Request 11 iced lattes and unavailable matcha from Outlet A.', 'No draft/order created; unavailable-item feedback displayed.'],
  T14: ['Advanced ambiguity/failure', 'Ask for a coffee, clarify with a named item/outlet, discard draft.', 'Clarification requested; discard creates no order.'],
  T15: ['FR-15 / AC-06', 'Use English and Egyptian Arabic sample voice buttons.', 'Both produce identical correct draft contents; no real speech service used.'],
  T16: ['NFR-03 / AC-07', 'Force loading, empty, and error outlet states; retry.', 'Each state is visible; retry restores the outlet list.'],
  T17: ['FR-07 / AC-03', 'Accept a courier job, try a second, cancel, simulate another courier winning.', 'First job assigned; busy courier blocked; competitor receives the next assignment.'],
  T18: ['FR-09/11 / AC-04', 'Accept #2002, advance kitchen, submit wrong-stage and reused pickup codes, deliver.', 'Wrong/reused codes rejected; delivery completes with one EGP 19 earning and EGP 1 commission.'],
  T19: ['FR-05 / AC-02/05', 'Create order, increase quantity and pay difference, then cancel food.', 'Sequence retained, quantity updated, full edited food value refunded once.'],
  T20: ['FR-01/14 / AC-06', 'Approve seeded ID application; customer asks for a person; open admin support.', 'Verification becomes approved and Salma’s escalation appears for admin.'],
  T21: ['NFR-03', 'Deny microphone/camera; use voice sample and open camera.', 'Useful permission feedback; typed assistant and QR input remain enabled.'],
  T22: ['FR-01 / client access', 'Wrong password, correct password, customer admin route, another customer’s order.', 'Login error then success; admin denied and non-owned order hidden. Client simulation only.'],
  T23: ['NFR-02 / validation', 'Tab to skip link and activate; enter 123 as checkout phone.', 'Focus enters main without route change; invalid phone preserved with feedback.'],
  T24: ['FR-07/10 / AC-03/05', 'Accept Mariam’s EGP 25 bid on #2010, cancel delivery only.', 'Destination locks; food continues; EGP 23.75 compensation and EGP 1.25 commission.'],
  T25: ['FR-01 / AC-06', 'Submit valid fictional registration; try outlets before admin approval; approve.', 'Account stays pending and gated until approval; only ID filename is retained by app.'],
  T26: ['FR-11 / NFR-03', 'Show empty jobs; try over-balance withdrawal, then withdraw EGP 10.', 'Empty state and validation shown; simulated withdrawal succeeds.'],
};

function specs(suites) {
  return suites.flatMap((suite) => [...suite.specs, ...specs(suite.suites ?? [])]);
}
const results = specs(report.suites).map((spec) => {
  const result = spec.tests[0].results.at(-1);
  const id = spec.title.split(' | ')[0];
  const [requirement, steps, expected] = details[id.split('-')[0]];
  return { id, title: spec.title, requirement, precondition: 'Fresh Chromium context, fictional seed data, production preview at 127.0.0.1:4173.', steps, expected, actual: result.status === 'passed' ? expected : result.errors.map((e) => e.message).join('\n'), status: result.status, durationMs: result.duration, source: `tests/${spec.file}:${spec.line}` };
});

async function sourceFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => entry.isDirectory() ? sourceFiles(`${dir}/${entry.name}`) : [`${dir}/${entry.name}`]));
  return nested.flat();
}
const files = [...await sourceFiles('src'), 'package.json', 'package-lock.json', 'vite.config.js', 'playwright.config.js', 'tests/frontend.spec.js'].sort();
const hash = createHash('sha256');
for (const file of files) hash.update(file).update(await readFile(file));
const browserVersion = execFileSync(process.execPath, ['--input-type=module', '-e', "import {chromium} from '@playwright/test'; const b=await chromium.launch(); console.log(b.version()); await b.close();"], { encoding: 'utf8' }).trim();
const evidence = { runAt: report.stats.startTime, durationMs: report.stats.duration, browser: `Chromium ${browserVersion}`, playwright: report.config.version, node: process.version, platform: process.platform, sourceSha256: hash.digest('hex'), counts: report.stats, results };
await mkdir('docs/evidence', { recursive: true });
await writeFile('docs/evidence/results.json', JSON.stringify(evidence, null, 2) + '\n');
const screenshotFiles = (await readdir('docs/evidence/screenshots')).filter((f) => f.endsWith('.png')).sort();
const markdown = `# Milestone 1 frontend test evidence\n\nRun: ${evidence.runAt} (UTC), 19 November 2026.\n\n${evidence.browser}; Playwright ${evidence.playwright}; Node ${evidence.node}; Windows. Production build served locally at http://127.0.0.1:4173/. Each test starts in an isolated context with fictional seed data.\n\n**${report.stats.expected} passed, ${report.stats.unexpected} failed, ${report.stats.skipped} skipped, ${report.stats.flaky} flaky.** Browser run: ${(report.stats.duration / 1000).toFixed(1)} seconds. All tests also assert no browser exceptions, console errors, or HTTP responses with status 400 or higher.\n\n## Reproduce\n\n\`\`\`powershell\nnpm ci\nnpx playwright install chromium\nnpm run test:e2e\nnpm run test:report\n\`\`\`\n\nThe executable scenarios are in [frontend.spec.js](../../tests/frontend.spec.js). Each result below has the same fresh-context precondition. Source fingerprint (SHA-256 of source, dependency files, config and tests): \`${evidence.sourceSha256}\`. Detailed timings and observed results: [results.json](results.json).\n\n## Test cases and actual results\n\n| ID | Requirement | Steps / input | Expected and observed result | Status |\n| --- | --- | --- | --- | --- |\n${results.map((r) => `| ${r.id} | ${r.requirement} | ${r.steps} | ${r.actual.replaceAll('|', '/')} | ${r.status.toUpperCase()} |`).join('\n')}\n\n## Scope and deferred checks\n\nT08–T11 in the SDD require a live backend (persistent API data, HTTP validation/status codes, server authentication, server ownership enforcement). They are deferred to Milestone 2 and are not counted as passes or skipped Playwright tests. T22 exercises browser simulation only. Real payment, speech, GPS, camera scanning and production identity verification are not tested because the demo does not implement them.\n\nAC-01 through AC-07 have frontend evidence across T04/T05/T23, T06/T07/T19, T17/T24, T18, T19/T24, T15/T20/T25, and T01/T03/T16 respectively. This is representative journey coverage, not exhaustive accessibility or multi-browser certification.\n\n## Defects fixed during verification\n\n- Mobile checkout summary inherited a desktop top offset, leaving a gap and overlapping the footer. Restricted the offset to the desktop breakpoint; recaptured the mobile/tablet screenshots.\n- The skip-to-content anchor conflicted with hash routing. It now focuses a focusable main element without changing route; T23 verifies keyboard activation.\n- Netlify builds inherited GitHub Pages’ repository subpath. Default builds now use root assets; the Pages workflow alone specifies /web-project/.\n\n## Screenshots\n\nFull-page captures use a 375 × 812 mobile viewport and 768 × 1000 / 1440 × 1000 tablet/desktop viewports; document height varies. The required checkout, order, and outlet screenshots cover all three widths. Additional captures document validation, loading/empty/error states, assistant drafts, courier and restaurant workflows, and admin review.\n\n${screenshotFiles.map((f) => `- [${f}](screenshots/${f})`).join('\n')}\n`;
await writeFile('docs/evidence/TEST-RESULTS.md', markdown);
console.log(`Saved ${results.length} test results and indexed ${screenshotFiles.length} screenshots.`);
