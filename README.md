# Wardrobe App · LoopWear

A private digital closet and outfit planner for making more of the clothes you already own. Built locally with **VS Code and Codex**, using the Workshop 5.2 use case and the supplied fashion references.

**Status:** the core local workflow has passed an end-to-end browser check with real Supabase Auth, PostgreSQL, private Storage, the separate worker and OpenAI. Registration/email confirmation was independently confirmed by the user. Verification used controlled temporary reference garments, which were removed afterward. The user-approved administrative account-deletion fix is now applied and verified on Supabase; broader security/pilot and deployment readiness checks remain. See [live verification](docs/live-verification.md). No AWS resources were provisioned and nothing was deployed.

**Navigation/inventory update:** the approved forward migration is now applied to the configured Supabase project, with **17 live API/provider checks and cleanup passed**. It enables reviewed text inventory/import, collections, Favorites, manual outfits, planning templates and Settings. Your provided wardrobe remains unimported until you explicitly review and submit it. Live verification also corrected a feedback response mismatch. See [hosted update evidence](docs/inventory-update-live-verification.md), [feature inventory](docs/feature-inventory.md), [Workshop 5.4 checklist](docs/workshop-5.4-testing-checklist.md) and [current test evidence](docs/testing.md).

## What’s included

The latest Workshop 5.4 high-risk phase passed **65 isolated API/database/schema tests, 92 fixture Chrome checks and 17 fresh live Supabase checks plus cleanup**. Type checking/build passed. The [284-case checklist](docs/workshop-5-4-testing-checklist.md) now records **131 scoped Passed, 147 Not tested, 6 Blocked, 0 Failed**. Two further defects were fixed: overlapping Favorites pending state and invalid edit-timestamp validation. See the [bug log](docs/workshop-5-4-bug-log.md), [current phase evidence](docs/workshop-5-4-phase2-results.json) and [read-only security review](docs/workshop-5-4-security-review.md). Personal-record fingerprints matched after disposable live cleanup; no hosted settings/schema or paid OpenAI operations changed/ran.

The previous Step1 [isolated evidence](docs/workshop-5-4-results.json) remains historical: 52 local and64 browser tests, two initial UI fixes, and the original108/167/9 case statuses. Current passes are scoped to executed behavior; no manual inbox/device/screen-reader or new real-model result is implied.

- Supabase email/password registration, confirmation handling, sign-in and sign-out; protected app screens and authenticated Express routes.
- Private JPEG, PNG and WebP uploads, an 8 MB limit, content decoding, image dimension limits, metadata removal, and five-minute signed photo URLs.
- A separately runnable worker with persistent `ai_tag_jobs`, three attempts per job, exponential retry delays, expiring leases, and stale-result protection.
- OpenAI Responses API garment proposals with strict Zod schemas; users approve or correct category, color, pattern and visible attributes before confirmation. Manual review also works without OpenAI.
- Search, category and status filters, sorting, garment editing and deletion.
- Occasion, style and season requests; up to three distinct complete outfit suggestions from confirmed owned inventory, validated before display and again before atomic saving.
- Saved outfit collages using uploaded photos, explicit wear recording, feedback, and history.
- Mobile bottom navigation and desktop sidebar for Today, My Closet, Outfits, Favorites and Settings; history is a secondary Outfits view. Accessible forms, native focus-trapped dialogs, reduced-motion styles and recoverable errors.
- Photo-free manually reviewed inventory, optional known quantities/units, packs/sets, brand/fit, flexible collections, a reviewed account-only import and persistent wardrobe favorites.
- Manual finished outfits with select/remove/replace/edit, separate editable sports/TBD templates, and explicit completion confirmation. AI remains optional.
- Four clearly labeled curated men's inspiration cards with real sources, original publication dates where available, fixed checked dates and neutral illustrations; no live feed. See [source provenance](docs/inspiration-sources.md).

No stock garments are presented as owned items. No weather feed, purchases, invented garment size/material/fit, or fake AI/authentication is included. Auth sessions use the Supabase browser SDK; wardrobe records persist in PostgreSQL, never browser-only storage.

## Stack and folders

| Folder | Responsibility |
| --- | --- |
| `apps/web` | React, TypeScript, Vite, Tailwind CSS 4, Lucide icons |
| `apps/api` | Express, TypeScript, Zod, image validation, Responses API, worker |
| `packages/shared` | Shared schemas, types and outfit eligibility rules |
| `supabase/migrations` | Original eight tables plus five update tables, indexes, RLS, constraints, RPCs and private Storage policies |
| `tests` | PostgreSQL/PGlite isolation tests, API flow tests, browser checks and opt-in live check |
| `docs` | Setup, architecture, verification evidence, development log and screenshots |
| `references` | Preserved original use case and seven supplied design images |

## Start on Windows PowerShell

Requires Node.js 24 or later and npm. The implementation was checked on Node **v24.21.0**, npm **11.19.0**. Use `npm.cmd` and `npx.cmd`: they work when PowerShell execution policy blocks `npm.ps1`, without changing your execution policy.

```powershell
Set-Location -LiteralPath 'C:\Users\fondj\OneDrive\Desktop\Fashion App\Digital Closet'
npm.cmd ci
if (-not (Test-Path -LiteralPath 'apps/api/.env')) {
    Copy-Item -LiteralPath 'apps/api/.env.example' -Destination 'apps/api/.env'
}
if (-not (Test-Path -LiteralPath 'apps/web/.env')) {
    Copy-Item -LiteralPath 'apps/web/.env.example' -Destination 'apps/web/.env'
}
```

Copy the environment examples **once**; avoid overwriting populated `.env` files later. Open both in VS Code and configure them as described below. Never paste secret keys into the browser file.

### 1. Configure Supabase

Use a Supabase project you control. In its SQL Editor, run the complete migration:

[`supabase/migrations/20261019105559_wardrobe_foundation.sql`](supabase/migrations/20261019105559_wardrobe_foundation.sql)

The foundation is intended for a fresh project and must be applied once. It creates the eight application tables and private `garment-photos` bucket. Then apply [`20261019125355_fix_auth_user_delete_cascade.sql`](supabase/migrations/20261019125355_fix_auth_user_delete_cascade.sql) to include the verified account-deletion fix. Both migrations are already applied to the configured project. See [database setup](docs/database-setup.md) for checks and existing-project guidance.

The approved [`20261019182024_wardrobe_inventory_update.sql`](supabase/migrations/20261019182024_wardrobe_inventory_update.sql) is **already applied to the configured project; do not reapply it**. Its local filename matches the recorded hosted migration version. For a fresh project, apply all three files in chronological order. No reset or global wardrobe seed is needed. Do not blindly run `db push` against the configured project: its SQL-Editor foundation is absent from remote migration history.

For inspection or setup of another project, copy the update SQL:

```powershell
Get-Content -LiteralPath 'supabase/migrations/20261019182024_wardrobe_inventory_update.sql' -Encoding UTF8 -Raw | Set-Clipboard
```

This command only copies SQL; it does not apply it. Apply once only where the update is absent. Confirm with `select public.wardrobe_update_version();` (expected `1`, verified on the configured project). Restart the API/web and local worker using the commands below if they still have older code loaded, then refresh the app. No further SQL is required for the configured project.

In **Authentication → Providers**, enable email/password. Set the Site URL and allowed redirect URL to `http://127.0.0.1:5173`. Keep email confirmation enabled if you want to verify real inbox ownership; configure your project's email delivery as needed. Registration then shows a confirmation message until the user follows the link. PKCE confirmation links should be opened in the browser that initiated registration.

In both files use the same Supabase URL and public **publishable** key (`sb_publishable_…`). A legacy `anon` key also works. In `apps/api/.env` only, set the server **secret** key (`sb_secret_…`) or legacy `service_role` key for the worker. The API handles user data with each user's token and RLS, not with that privileged key.

`apps/web/.env`:

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

`apps/api/.env`:

```dotenv
PORT=3001
WEB_ORIGIN=http://127.0.0.1:5173
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_PUBLISHABLE_KEY=your-publishable-key
SUPABASE_SECRET_KEY=your-server-secret-key
OPENAI_API_KEY=your-openai-api-key
OPENAI_MODEL=your-selected-model-id
```

The values above are placeholders. All `.env` files are ignored by Git. Only the Supabase URL and publishable key go into `VITE_` variables; Vite exposes those values to browser code.

### 2. Configure OpenAI

Use an OpenAI API project key with billing and access to your chosen model. Set `OPENAI_MODEL` to a model that supports **Responses, image inputs, and structured outputs**. There is deliberately no hardcoded model default. Model access depends on your account; changing this server environment variable requires restarting the API and worker. Photos submitted for AI analysis are sent to OpenAI; requests use `store: false`. See [provider references](docs/provider-references.md).

Without OpenAI, real accounts, uploads, manual garment review and saved-outfit management still work. AI buttons give setup guidance; no synthetic AI fallback runs.

### 3. Run the app and worker

In terminal 1:

```powershell
npm.cmd run dev
```

In a second PowerShell terminal, from the same root folder:

```powershell
npm.cmd run worker
```

Open **http://127.0.0.1:5173/**. The API is on **http://127.0.0.1:3001**. Health: `http://127.0.0.1:3001/health`. Vite proxies `/api` to Express. Keep these default ports and `WEB_ORIGIN` aligned: changing `PORT` also requires updating the proxy target in `apps/web/vite.config.ts`. Keep the worker running to consume queued photo jobs. Stop each terminal with Ctrl+C. Restart after editing `.env` files.

With no credentials, the account screen displays setup guidance and blocks sign-in. The API returns actionable configuration errors; the worker exits with a list of missing settings.

## First real workflow

1. Create an account, follow email confirmation if enabled, and sign in.
2. Add a photo of one of your garments. The upload creates a private **pending** draft.
3. Choose **Suggest tags with AI**, or enter the details manually. The worker's queue status appears in the review dialog.
4. Correct the name and tags, then choose **Confirm & add to my closet**. AI results alone never confirm garments.
5. Add and review shoes plus a dress, or shoes plus a top and bottoms. More pieces or optional layers create more combinations.
6. Open **Outfits -> Suggest with AI**, enter an occasion, style and season, then request suggestions. Save a look you like.
7. Open a saved outfit, record a real wear date, and add a rating. History changes only after your explicit wear confirmation.

AI suggestions contain shoes plus a dress, top/bottom, or an explicitly reviewed full set, with at most one optional outerwear and one accessory. If confirmed inventory supports fewer than three distinct combinations, the app explains the limit. Invalid AI responses are rejected. Manual outfits instead use 1–20 distinct reviewed owned records and your explicit confirmation that the combination is finished; a swim kit or set does not need separate everyday clothing pieces.

## Review your provided wardrobe and build a look

1. Sign in and open **My Closet → Review provided wardrobe**. The source proposes **86 inventory records and 14 planning templates**, not a physical wardrobe total.
2. Select a description. Edit its known details, keep unknown quantities/colors/brands unspecified, and resolve any overlap as a separate record, an existing reviewed item, or Skip. Confirm review for each selected entry.
3. Choose **Import selected reviewed entries**. The result reports created/linked/skipped/failed entries. Retry failed entries after correcting them. Previously imported entries are disabled; repeats and deleted-record tombstones prevent accidental duplication.
4. In My Closet, search/filter the imported records. Use **Add photo** to attach a real private image, or the heart button to add an item to **Favorites**. An attached photo does not reset reviewed metadata or create another record.
5. Open **Outfits → Build an outfit**. Select reviewed items, remove/replace choices, name the look and choose occasion/style/season. Preview photos or honest category placeholders, confirm it is a finished combination, then save.
6. Open the saved look to edit it, rate it or record a wear. Find wear records under **Outfits → Wear history**. Template plans are under **Planning templates**; match or explicitly remove missing components before creating a finished look. “Thigh” needs your clarification.
7. Use **Settings** for display name, optional gender, style/default occasion and sign-out. Gender is never inferred and does not restrict clothing categories.

To regenerate the reviewed-source mapping locally, run `node scripts/build-provided-inventory.mjs`. This does not import or modify database records.

## Local checks

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npm.cmd run test:browser
npm.cmd audit
```

Browser checks use an installed Google Chrome browser (`channel: 'chrome'`) at 320, 390, 768 and 1440 pixel widths. They use isolated test-only provider responses on port 5174. See [testing](docs/testing.md) for environment requirements, test boundaries, and the opt-in live integration check. Tests never run against your real Supabase project by default.

After building, the compiled API can also run with:

```powershell
npm.cmd run start -w @wardrobe/api
```

This starts the API only; local frontend development still uses `npm.cmd run dev -w @wardrobe/web`. Production web serving/deployment is outside this local phase.

## Verification and limits

Local verification results and remaining acceptance checks are in [docs/testing.md](docs/testing.md) and [docs/development-log.md](docs/development-log.md). PGlite exercises real PostgreSQL constraints and RLS, while default test adapters simulate Auth, Storage and AI. Those default tests remain separate from the subsequent [live integration check](docs/live-verification.md), which used actual services and no network mocks.

Inventory browsing uses server-side filters and successive pages; the builders load the account's inventory across those pages. Before applying the update, legacy browsing retains its 1,000-record bound. Saved outfits/wear records remain limited to 500 and AI generation to 500 confirmed inventory records. Very large wardrobes still need performance testing. Signed photo URLs expire after five minutes, and active data refreshes every four minutes; use **Refresh wardrobe** to recover stale photos after a sleeping tab. Requests time out after 90 seconds; refresh before retrying an upload or save because a timed-out write may already have reached the server. Import retries use stable identifiers. Deleting an item invalidates affected saved looks and preserves history. Deleting a saved outfit also deletes its wear logs and feedback, with confirmation.

Storage and PostgreSQL are separate services, so photo upload/deletion cannot be a single database transaction. Recoverable failure behavior and residual cleanup limits are described in [architecture](docs/architecture.md).

## Future AWS phase

This phase replaces the workshop's SQS/Lambda path with a local persistent worker. The proposed future architecture retains the database job record as the source of truth and moves delivery to SQS and processing to Lambda, with idempotency, bounded retries and a dead-letter queue. The workshop's proposed hosting path is a versioned Docker image in ECR deployed through GitHub Actions to Elastic Beanstalk, with HTTPS, health checks, managed secrets and CloudWatch. Eligibility, current service constraints, costs and all deployment configuration must be revalidated before that phase. No AWS deployment artifacts are claimed as tested. See [the future plan](docs/architecture.md#future-aws-plan).
