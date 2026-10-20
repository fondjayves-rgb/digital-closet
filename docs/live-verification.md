# Live integration verification

Verified October 19, 2026, using the configured Supabase and OpenAI services and the existing local frontend, Express API and separately running worker. No application rebuild, deployment, credential changes or architectural changes were performed.

## Results

| Check | Evidence | Result |
| --- | --- | --- |
| Environment consistency | Both Supabase URLs valid and matching; public keys match; privileged/OpenAI keys absent from frontend configuration | Passed without printing credential values |
| Local services | Frontend HTTP 200, API health HTTP 200, frontend `/api/setup` proxy reports all required services configured | Passed |
| Hosted migration | All eight tables accessible; RLS enabled on all eight; policies and constraints present; app RPCs use invoker security | Passed read-only inspection |
| Worker RPC privileges | Anonymous/authenticated users cannot claim or finish jobs; service role can | Passed read-only inspection |
| Authentication settings | Email/password enabled; public sign-up enabled; email confirmation required | Passed live settings check |
| Registration and confirmation email | User reported: “Yes, it works” after registering, receiving confirmation and signing in | **User-confirmed manual check**, not automated inbox verification |
| Real sign-in | Two disposable confirmed accounts signed in using the real password endpoint; Chrome signed in through the actual application | Passed live |
| Private Storage | Private bucket; 8 MB limit; normalized WebP allowed; signed photo download succeeds; public URL and other-account access fail | Passed live |
| Upload | Chrome uploaded an authorized reference image; database record was owned and pending | Passed live |
| Worker and AI tagging | Separate worker consumed the persistent queued job, downloaded its photo and stored a real OpenAI structured tag proposal | Passed live; proposal did not confirm the garment |
| Tag approval | Browser edited and approved tags; API/database readback confirmed the approved record | Passed live |
| Outfit recommendations | OpenAI returned three distinct complete looks; all IDs validated against the temporary account's confirmed inventory | Passed live through the browser and API |
| Saving and isolation | Browser saved a suggested outfit; API, direct RPC and direct association attempts from another account were rejected | Passed live |
| Wear history and feedback | Browser explicitly recorded a wear, rated the outfit and viewed persisted history; other account saw no wear logs | Passed live |
| Sign-out | Protected UI disappeared and remained unavailable after reload; no uncaught browser errors | Passed live |
| Test-data cleanup | Temporary photos and records removed; subsequent lookup found zero remaining accounts from the completed run | Passed after explicit child-record cleanup |
| Existing local regression tests | `npm.cmd test` | 35 passed after adding the account-deletion regression; these are isolated PostgreSQL/API/schema tests, not live-provider tests |
| Type checking | `npm.cmd run typecheck` | Passed, including new verification scripts |

The live browser runner does not intercept or mock any network requests. It stores no Playwright traces, browser storage-state files, tokens, passwords or provider payloads. Sanitized per-step evidence is in `live-workflow-results.json`.

## Test-data boundaries

The user authorized using the supplied capsule-wardrobe reference. The check used cropped reference images in temporary accounts, with garment names prefixed `LIVE TEST`. One garment was analyzed by the real worker/OpenAI path and approved through the browser. Four additional reference garments received explicit test labels, creating three complete supported combinations. These records are test fixtures, not assertions about the user's personal possessions. The check establishes actual service integration, not recognition accuracy, a personal styling assessment, or a user pilot metric.

The agent did not send registration emails. Disposable accounts were created already confirmed through the server-only administrative API, then signed in normally. Real registration/email delivery was confirmed separately by the user. Only this run's temporary accounts and their associated data were deleted; the user's account and wardrobe were preserved.

## Issues found

### Administrative account-deletion cascade

The application workflow passed, but deleting a temporary Auth account with saved outfits initially returned HTTP 500 (`unexpected_failure`). Deleting that account's outfits and garments explicitly first allowed account removal; no temporary records remain from the completed run.

The same issue was reproduced in isolated PostgreSQL as SQLSTATE `23503`, on `outfits_user_id_fkey`. During an Auth user cascade, `private.after_item_change()` attempts to mark an outfit unavailable after its Auth owner has already been removed. The outfit's foreign key prevents that update.

`proposed-account-cleanup-fix.sql` guards the outfit invalidation update when the owner row no longer exists. Local verification confirmed that the proposal:

- Allows account deletion while leaving another account intact.
- Keeps ordinary garment deletion invalidating affected saved outfits and preserving wear history.
- Keeps manual tag approval cancelling pending AI jobs.

**The user approved the fix, and it was applied to Supabase on October 19, 2026.** The canonical migration is `supabase/migrations/20261019125355_fix_auth_user_delete_cascade.sql`; its version matches the recorded live migration. No tables or existing wardrobe records were rewritten. The private trigger retains its restricted execution privileges.

A subsequent live check used two disposable accounts to verify direct Auth account deletion with saved outfits/history, isolation of the other account, ordinary garment deletion preserving history/feedback, and manual tag approval cancelling queued work. All seven checks and final account cleanup passed. Sanitized evidence is in `account-cleanup-fix-results.json`. The default PostgreSQL tests now apply both migrations and include an account-deletion regression. The earlier cleanup workaround remains safe but is no longer required to avoid the original database error.

### Supabase Security Advisor

The read-only advisor reported:

- Public `EXECUTE` grants on the existing `public.rls_auto_enable()` helper for both `anon` and `authenticated`. Catalog inspection shows it returns `event_trigger` and is attached to an event trigger; the advisory alone does not demonstrate an ordinary callable application RPC exploit. Review the grants before deployment. [Anonymous execution advisory](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [authenticated execution advisory](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).
- Leaked-password protection is disabled. Review availability and enable it where appropriate before deployment. [Supabase password security](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

No advisor-driven database privileges or Auth settings were changed.

### Verification harness correction

Two initial attempts stopped at the category field because the test used an overly exact label selector. Narrowing the selector to the review dialog's category control resolved it. This required no application source change. Live tagging passed during those attempts, and their temporary accounts/photos were cleaned up. A later full run passed every functional check.

## Repeat checks

Keep the configured development API/frontend and worker running in separate terminals. From the workspace root:

```powershell
node --env-file=apps/api/.env --import tsx tests/live-preflight.ts
$env:WARDROBE_VERIFY_LIVE = 'yes'
node --env-file=apps/api/.env --import tsx tests/live-workflow.ts
Remove-Item Env:WARDROBE_VERIFY_LIVE
```

The full runner creates disposable test accounts, uploads the approved reference fixtures and makes real OpenAI requests. It incurs normal provider usage and removes its test data afterward. It never applies migrations. If cleanup is interrupted, the scoped repair helper can clean only the uniquely named temporary accounts from the report's recorded time window:

```powershell
node --env-file=apps/api/.env --import tsx tests/live-cleanup.ts
```

The proposed SQL can be checked without any provider connection:

```powershell
node --import tsx tests/verify-account-cleanup-proposal.ts
```

## Subsequent approved inventory update

The later navigation/inventory migration is now applied and has its own [live evidence](inventory-update-live-verification.md) and [seventeen-check report](inventory-update-live-results.json). It used disposable accounts, actual API routes and Supabase Auth/database/private Storage, without model or browser calls. Those checks do not replace or relabel the earlier OpenAI/browser evidence above.

## Still unverified

This run does not establish recognition accuracy across diverse photos, pilot completion rates, exhaustive cross-account security, signed-URL expiry after prolonged idle time, outage/recovery behavior, concurrent-worker stress behavior, every device/browser, or deployment readiness. It verifies the requested core workflow end-to-end with real services using controlled temporary test data.
