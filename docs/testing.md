# Verification evidence and next acceptance checks

## Workshop 5.4 — latest high-risk phase

Current [phase results](workshop-5-4-phase2-results.json), [live results](workshop-5-4-live-results.json), [preservation evidence](workshop-5-4-preservation-results.json), [checklist](workshop-5-4-testing-checklist.md), [bug log](workshop-5-4-bug-log.md) and [security review](workshop-5-4-security-review.md).

| Check actually performed | Result | Boundary |
| --- | --- | --- |
| Full API/database/schema suite | **65 passed**, five files | Previous52 plus13 meaningful new security/integrity/failure cases; actual Express/PGlite, simulated identity/bytes/AI |
| Full Chrome matrix | **92 passed**, exit0 | Previous64 plus seven new scenarios per width at320/390/768/1440; network fixtures |
| Fresh real Supabase/API run | **17 passed plus cleanup**, exit0 | Two disposable accounts, real password sessions/RLS/database/private Storage, technical image; no browser/email/model calls |
| Aggregate preservation | **Matched across all13 application tables** | Counts/MD5 before temporary live run and after cleanup; no personal row values in artifact |
| Type checking | Passed after test-only ID-array annotation correction | Workspaces and tests |
| Production build | Passed | Existing two Zod annotation warnings remain non-failing |
| Hosted Advisors/catalog review | Three existing WARN categories/eight INFO findings | Read-only inspection; all13 tables RLS-enabled, Storage private; no hosted correction applied |
| Checklist disposition | **131 Passed / 0 Failed / 6 Blocked / 147 Not tested** | 23 newly completed original cases;3 formerly Blocked cases correctly moved to automatable Not tested |

New tests cover anonymous/new-RPC permissions, new-table/association isolation, real stale-version rejection and retained history, manual0/20/21 bounds, invalid/duplicate wear dates and every rating, dependent deletion/cancellation/failure recovery, template tombstones, mixed import retry, post-model-latency inventory revalidation, safe error sanitization, photo upload/sign/delete failures, signup constraints/confirmation notice, sign-out failure, conditional analysis states and overlapping Favorites.

Two new confirmed defects were reproduced before fixes: an in-flight Favorite card incorrectly re-enabled after another card was clicked; malformed `expectedUpdatedAt` returned503 instead of400. Both now pass focused/current full regressions. A browser-test email fixture had255 instead of254 characters, and the new test ID array initially needed an explicit TypeScript type; both tooling issues were corrected before final successful runs.

The live runner's `--phase2` flag writes a new artifact, preserving earlier evidence. Its data writes/cleanup were scoped to temporary accounts/records/image under the user's disposable-testing request. No personal records, hosted schema/configuration, Supabase Auth settings or paid OpenAI calls were changed/executed. Read-only advisor review is distinct from those disposable live data operations. No actual email delivery, token/photo expiry, real-browser two-account switch, physical device or screen-reader session was performed. Session/photo expiry and browser switching are automatable follow-ups; email/physical/assistive experience needs the user's environment, and paid AI/hosted corrections need explicit approval.

Repeat isolated checks with the standard README commands. Fresh non-paid live disposable check: `npx.cmd tsx --env-file=apps/api/.env tests/verify-inventory-update-live.ts --phase2`. It creates/removes temporary accounts and a private technical image, writes only sanitized results and never applies SQL or calls a model. Re-running still requires staying within disposable-data authorization.

The worksheet generator preserves these phase2 case overlays from the new evidence artifact when run with `--verified`; it does not replace historical Step1 evidence. As before, preserve manual annotations before regeneration.

## Workshop 5.4 Step 1 — historical systematic baseline

See the new [systematic checklist](workshop-5-4-testing-checklist.md), [bug log](workshop-5-4-bug-log.md) and [sanitized run record](workshop-5-4-results.json). The older dotted-name update checklist remains historical input; it is not the current assignment's acceptance result.

| Check actually performed in this assignment | Actual result | Boundary |
| --- | --- | --- |
| Source/documentation inspection | 284 cases inventoried; 108 scoped Passed, 167 Not tested, 9 Blocked | Conditional controls/native options and manual follow-ups included; a scenario pass does not prove every field/variant |
| `npm.cmd test` | 52 passed, four files | Current isolated baseline before the two web-only fixes; API/database/shared code unchanged |
| New defect reproduction, desktop | Two failed before fixes | Collections omitted on Enter; stale replacement after target removal |
| Focused desktop retest | Two passed after fixes | Both actual outgoing/reopened collection data and replacement recovery asserted |
| `npm.cmd run test:browser -- --reporter=list,json` | 64 passed, exit0 | Sixteen scenarios at each of320/390/768/1440px; 56 existing checks plus two meaningful regressions repeated at four widths |
| `npm.cmd run typecheck` | Passed, exit0 | Workspaces and test TypeScript after fixes |
| `npm.cmd run build` | Passed, exit0 | Production assets after fixes; two existing non-failing Zod annotation warnings |
| New live provider, inbox, manual UI/device checks | Not performed | No paid OpenAI calls, hosted mutation or personal-record deletion; older live evidence is not a current pass |

Only two targeted UI fixes were made: shared collection state now updates while typing, so Enter does not omit it; removing an active replacement target cancels replacement. The two added browser scenarios first failed on those behaviors, then passed. Existing tests were reused for all other exercised paths. The [bug log](workshop-5-4-bug-log.md) separates these findings from earlier cleanup/feedback/quality corrections and from unverified concerns.

Checklist Passed entries name their current automation/source evidence; no manual UI check was marked Passed. Additional maximum-length/options/status-code combinations remain explicit queued cases. Inbox confirmation, controlled live expiry/photo timing, a new paid worker/model exercise, physical phones, screen readers and alternate browser sessions are Blocked with required user actions. Some live exercises were intentionally not repeated; this does not assert that configured credentials are absent.

To regenerate the source-based worksheet before manual annotation: `node scripts/build-workshop-5-4-checklist.mjs --verified` reads this assignment's passing report. **Regeneration overwrites worksheet annotations**; preserve manual results first. Run without `--verified` to produce a fresh Not tested/Blocked worksheet. Raw current Playwright JSON is in ignored `test-results`; the committed-style document contains only sanitized case outcomes. This workspace has no Git repository, so no commit/tracked-file audit is claimed.

Initial implementation checks were recorded October 19, 2026, before real provider credentials were configured. **A subsequent live integration run passed the core workflow with the configured services, and the approved account-deletion fix was then applied and verified live.** See [live-verification.md](live-verification.md), [workflow results](live-workflow-results.json) and [trigger-fix results](account-cleanup-fix-results.json) for that baseline evidence. The 34/35-test and 6/32-browser-check results below are historical; the navigation/inventory update has its own verification record.

## Navigation/inventory update: October 19, 2026

The update adds dedicated `features.test.ts` tests and six browser feature scenarios per viewport. Tests never silently use the populated provider environments.

| Check actually executed | Final result | Boundary |
| --- | --- | --- |
| `npm.cmd test` | **52 passed**, four files | Original 35 plus 17 feature/upgrade/cascade tests; isolated PostgreSQL/API/schema tests |
| `npm.cmd run test:browser` | **56 passed** | Fourteen isolated Chrome checks at each of 320, 390, 768 and 1440 px |
| `npm.cmd run typecheck` | Passed | All workspaces and tests, including the updated opt-in live runner's types |
| `npm.cmd run build` | Passed | Compiled API and production web assets; no deployment |
| Strict unused-code checks | Passed | Both web and API with `--noUnusedLocals --noUnusedParameters` |
| Credential comparison and environment placement | Passed | 80 inspected source/test/documentation/migration/build files; zero configured privileged-key matches; no privileged key in web environment; ignore rules present |
| Local documentation links | Passed | Eight inspected documents; no missing local link targets |
| Representative screenshot inspection | Performed | Desktop and mobile Today/Closet/outfit screenshots; generated with clearly named fixture records |
| New hosted migration / live update flow | **Applied; 17 passed checks plus cleanup** | Real Supabase Auth/database/private Storage and actual API routes; no new browser/email/OpenAI run |

The workspace is not a Git repository; no tracked-file or commit audit is claimed. No key values were printed or placed in verification artifacts.

The database tests apply all three actual migration files to isolated PGlite. A separate upgrade test first loads only the original two migrations, creates wardrobe/outfit/wear/feedback records, applies the new migration and compares retained fields and history. Additional tests cover unknown metadata, no-photo job rejection, private photo attachment without duplicate inventory, profile/favorite isolation, collection ownership, full inventory filtering/pagination/French aliases, import preview/bounds/review/concurrency/deduplication/tombstones/linking, manual save/edit/confirmation/foreign and pending IDs, template matching/deletion and strict reviewed-set AI eligibility. A new cascade check creates the additional collection/template/import/manual-outfit relationships before Auth deletion, preserving the previously approved fix.

API tests use the actual Express routes, SQL functions and RLS. Identity, image byte storage/signing and AI are test boundaries, not live Supabase/OpenAI. Concurrent HTTP import requests exercise local deduplication; this is not multi-process hosted load testing.

Browser checks use installed Chrome with isolated provider/API responses on port 5174 at **320, 390, 768 and 1440 px**. They cover the five destinations; dated curated inspiration and retry; text inventory review/edit and photo attachment; card/detail favorites, failed-save recovery and persistence; manual select/replace/remove/save/edit plus history retention; import preview/review/repeat behavior and missing-component plans; Settings save/failure/reload and both builder defaults; 205-record pagination, metadata filters and every category; original upload/manual tag approval/AI suggestion/save/wear/feedback/sign-out; error/empty/loading/focus/contrast/overflow regressions. Browser persistence assertions reload the app while keeping the fixture backend in memory; separate live persistence evidence is recorded below.

`docs/screenshots/update-*` and refreshed quality/account screenshots are clearly isolated fixture views. Source URLs/publication dates were separately inspected through actual publisher pages during planning/implementation; browser URL/date assertions do not establish publisher availability. See [source provenance](inspiration-sources.md).

The [feature inventory](feature-inventory.md) describes all additions, and the [Workshop 5.4 checklist](workshop-5.4-testing-checklist.md) enumerates **152 controls/parameterized control families**. B/Q references describe exercised browser scenarios; M entries explicitly remain manual/unperformed. No participant completion score, recognition accuracy or accessibility certification is invented.

The approved update is applied at hosted version `20261019182024`, with **17 final live checks and cleanup passed**. Live verification exposed PostgREST's to-one feedback object versus the app's array contract; the API now normalizes the response and the adapter reproduces the actual hosted shape. The first two failed runs cleaned up successfully; the final run passed. After this correction, all 52 local regressions, 56 isolated Chrome checks, type checking and production build passed again. The browser process exited successfully and its disposable server stopped. See [hosted update evidence](inventory-update-live-verification.md) for the real-provider boundaries, preservation observations, both advisor results and repeat command. No new OpenAI/model or live-browser result is claimed. Earlier baseline results remain separate.

Physical devices, Safari/Firefox, screen-reader output, full zoom/text scaling, large-wardrobe performance, real outages/timeout and multi-worker stress remain unverified. Two existing non-failing Zod annotation warnings remain during production build. No dependency changes, fresh npm audit, deployment or cloud provisioning occurred.

## Focused quality review: October 19, 2026

| Check | Result | Scope |
| --- | --- | --- |
| `npm.cmd test` | **35 passed** | Existing PostgreSQL, API and recommendation/schema regressions |
| `npm.cmd run typecheck` | Passed | API, web, shared package and test/configuration TypeScript |
| `npm.cmd run build` | Passed | Compiled API and production frontend; two existing Zod annotation warnings |
| `npm.cmd run test:browser` | **32 passed** | Eight checks at each of 320, 390, 768 and 1440 px in installed Chrome |
| Additional TypeScript unused-code checks | Passed | Web and API checked with `--noUnusedLocals --noUnusedParameters` |
| Private credential-value scan | Passed | No configured OpenAI/server-key values found in 50 inspected source, test, documentation and frontend-build files; no privileged key in the web environment; `.env` ignore rules present |

These browser checks use **isolated network fixtures**, not live Supabase/OpenAI. This review did not rerun provider operations, the live worker, migration application or email delivery. Earlier live results remain separate evidence. No dependency installation/update, fresh audit, database change or deployment was performed during this review.

The new quality checks cover initial connection failure versus an empty closet, refresh progress, broken-photo recovery, invalid upload replacement, upload/status/planner request failures and retries, preservation of review edits, whitespace validation, explicit category selection, empty closet/history screens, keyboard focus visibility, dialog containment/restoration, and focus on generated results. Screens are checked for horizontal document/dialog overflow. Selected closet text is checked for at least 12 px and 4.5:1 contrast; mobile search input and navigation checks cover 16 px input text and 44 px touch height. These selected assertions are not a complete WCAG audit.

Screenshots in `docs/screenshots/quality-*` show fixture garments only. Closet images show keyboard focus; outfit images scroll the dialog to the generated card. Account and Today fixture screenshots were refreshed at all four widths. Representative desktop and mobile images were visually inspected against the supplied reference direction: neutral backgrounds, rounded garment grids, photo collages and persistent mobile navigation.

Still manual or deferred: physical iOS/Android devices, Safari/Firefox, screen-reader output, browser zoom/text enlargement, provider/network outage recovery including the 90-second timeout, multi-worker stress, and the real user pilot/recognition benchmark. No accessibility certification or new live-provider success is claimed.

## Original implementation checks

| Check | Result | What it establishes |
| --- | --- | --- |
| `npm.cmd install` and dependency updates | Passed | Dependencies installed; lockfile retained |
| `npm.cmd run typecheck` | Passed | API, web, shared package, tests and Playwright configuration type-check |
| `npm.cmd test` | **34 passed** | 19 PostgreSQL/RLS/job tests, 11 API-flow tests, 4 recommendation/schema tests |
| `npm.cmd run build` | Passed | Compiled API and production frontend assets generated |
| `npm.cmd run test:browser` | **6 passed** | Desktop/mobile account UI and complete protected UI workflow using test-only network fixtures |
| API `/health` and `/api/setup` | Passed | Local server responds and accurately reports missing setup |
| Compiled API `start` script on port 3002 | Passed | Built Node entry point starts and responds to health checks |
| Worker without credentials | Expected setup exit | Actionable missing-configuration message; no AI processing claimed |
| `npm.cmd run test:live` without credentials | **Not run**, expected setup exit | Live credentials are missing; no hosted account or AI check claimed |
| `npm.cmd audit` / production audit | **0 vulnerabilities** | No vulnerabilities reported by npm at the final check |

The production build emits two non-failing annotation warnings from the installed Zod package. No source/build failure remains. Windows sandbox restrictions initially prevented esbuild directory reads and tsx account lookup; the same checks succeeded with the environment's approved normal tool access. `npm.ps1`/`npx.ps1` are blocked by PowerShell policy here; `.cmd` commands work without altering that policy.

## What the tests do

`tests/database.test.ts` runs the **actual application migration** in isolated PostgreSQL via PGlite. Minimal Auth/Storage schemas stand in for the Supabase-managed schemas. It switches PostgreSQL roles and user IDs rather than merely inspecting SQL text. Tests cover table RLS, owner-only access, cross-account association rejection, pending/confirmed constraints, atomic saving, private-object policies, restricted worker RPCs, history preservation, retry bounds, lease recovery and cancellation after review.

`tests/api.test.ts` calls the real Express routes through Supertest. Its test-only adapter sends data operations to that same real PostgreSQL schema with RLS, while Auth identity, photo byte storage, URL signing and AI responses are simulated. It covers authenticated routing, uploads and content validation, analysis jobs, human confirmation, foreign-ID rejection, insufficient inventory, three supported combinations, atomic saving, explicit wear logs, feedback and deletion. It is a backend integration test, not a live Supabase/OpenAI test.

`tests/recommendations.test.ts` rejects unknown, foreign, pending and duplicate IDs, incomplete/duplicate looks and unsupported inferred claims. It verifies owned complete looks and optional-layer capacity.

`tests/browser` runs installed Chrome at 320, 390, 768 and 1440 px viewport sizes. Playwright starts a separate web server on **5174** with a reserved, nonfunctional provider hostname, then intercepts provider/API traffic inside the test. `fixtures.ts` holds the shared test responses. The suite exercises navigation, search, file selection, manual tag confirmation, outfit generation/display/save, modal Escape behavior, user-confirmed wearing, feedback, history and sign-out, plus the quality checks listed above. It also checks account form keyboard access and no uncaught page errors. This is test infrastructure; application source has no fake-auth or demo-data mode. `today-test-fixture-*.png` screenshots use clearly named test garments and vector test images, not a real account or recognition result.

Generated screenshots are under `docs/screenshots`. The account screenshots show the frontend; dashboard screenshots demonstrate test fixtures only. No accessibility certification or cross-browser matrix is claimed.

## Repeat local checks

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npm.cmd run test:browser
npm.cmd audit
```

Browser checks require installed Google Chrome. If Chrome is unavailable, install it or deliberately change `channel` in `playwright.config.ts` to an installed supported browser. The isolated browser server reserves port 5174 and does not reuse a server with unknown environment configuration. Normal development remains on 5173. No Supabase project is needed for default tests.

## Opt-in live integration check

Use a **dedicated, migrated Supabase test project**. Configure `apps/api/.env` with that project's URL, publishable key and server secret. The script creates two confirmed disposable test users administratively (no confirmation emails are sent), then signs in through the real password endpoint. It uploads fixtures, checks private/signed photo access and cross-account rejection, confirms tags, saves a look, records a wear, adds feedback and removes its test objects/accounts in `finally`.

```powershell
$env:LIVE_TEST_PROJECT = 'yes'
npm.cmd run test:live
```

OpenAI is **not** called by that default live check. To also test the actual model, explicitly configure the OpenAI key/model and an authorized garment photo:

```powershell
$env:LIVE_AI = 'yes'
$env:LIVE_GARMENT_PHOTO = 'C:\path\to\your-garment.jpg'
npm.cmd run test:live
Remove-Item Env:LIVE_AI
Remove-Item Env:LIVE_GARMENT_PHOTO
Remove-Item Env:LIVE_TEST_PROJECT
```

Use a test project with no unrelated pending jobs: the live script invokes the real worker claim path. The OpenAI variant sends the specified image to OpenAI and can incur API charges. The three catalog records in this check are explicitly synthetic manual-tag fixtures, so even a passing run is not evidence of recognition accuracy on real clothing. If cleanup reports a failure, remove the `wardrobe-test-…@example.test` accounts and integration photos in that test project.

## Acceptance items from the initial implementation

The core live workflow, user-reported registration/email confirmation, private uploads, real OpenAI recognition/suggestions and Security Advisor inspection were subsequently exercised; see the live report. The remaining list records the original acceptance scope, including broader tests still outstanding.

- Real user registration and inbox confirmation with the configured email service; PKCE behavior in the initiating browser.
- Live execution of the two-account integration script and Supabase Security Advisor review.
- Actual private Storage uploads, short-lived signing/expiry, recovery after provider outages and account switching.
- Real OpenAI image recognition and requested outfit count/model access using the configured model.
- Worker behavior across real processes and network outages, including database locking under multiple workers.
- End-to-end browser workflow against real Auth, PostgreSQL, Storage, worker and OpenAI together.
- Mobile-device usability and a broader accessibility/browser review with real photos.
- The workshop's proposed 10-tester/80% completion goal, 100-photo/90% tag agreement goal, 100% real recommendation-ID validity, and 50 cross-account checks. These are targets; none is reported as a measured pilot result.

The core local workflow has live-service evidence; the app is not deployed or fully assessed for production readiness. Broader acceptance targets and the manual checks above remain outstanding.
