# Database and private Storage setup

Use a fresh Supabase project for the first setup. The configured project already has the foundation and both user-approved forward migrations. Live verification used disposable accounts and clearly labeled technical/reference fixtures, not the user's personal wardrobe photos.

## Navigation/inventory update — applied and verified

The forward migration is `supabase/migrations/20261019182024_wardrobe_inventory_update.sql`. It preserves existing rows and creates five owner-scoped tables: `collections`, `item_collections`, `outfit_templates`, `template_components` and `wardrobe_import_entries`. There are thirteen application tables after it runs. Existing photo paths/IDs/history remain, while new metadata defaults stay unspecified. Photo paths become nullable for text inventory; confirmed records still require a category. Missing color is explicitly allowed instead of invented.

The update also adds atomic manual inventory/import/outfit/template helpers, strict owner relationships, explicit grants/RLS and a no-photo job guard. The approved account-deletion trigger remains intact. No user inventory is seeded by the SQL.

The update is **already applied to the configured project; do not reapply it**. Its local filename matches hosted version `20261019182024`; the SQL contents are unchanged from the original CLI-generated file `20261019173835_wardrobe_inventory_update.sql`. No further SQL command is required for this project. Do not reset or blindly push migrations while the foundation's migration-history entry is unreconciled. For inspection or another project's setup, PowerShell can copy the exact SQL:

```powershell
Get-Content -LiteralPath 'supabase/migrations/20261019182024_wardrobe_inventory_update.sql' -Encoding UTF8 -Raw | Set-Clipboard
```

`select public.wardrobe_update_version();` returns `1` on the configured project. All thirteen application tables have RLS enabled and the bucket remains private. Refresh the app; restart API/web/worker from README commands if they still have older code loaded. The authenticated capability endpoint now enables the update. Neither the copy command nor local tests apply hosted SQL.

For fresh projects, apply foundation, cascade fix, then inventory update once each, in order. Hosted application, seventeen live feature checks and cleanup passed; both advisors were run. See [hosted evidence and remaining advisor findings](inventory-update-live-verification.md). Populated pre-update preservation is tested in isolated PGlite. The hosted wardrobe was empty before this application, so that local evidence is not relabeled as preservation of a populated hosted wardrobe.

## Original foundation setup

1. Open the Supabase dashboard for the intended project.
2. In SQL Editor, run `supabase/migrations/20261019105559_wardrobe_foundation.sql` in full, once, followed by `supabase/migrations/20261019125355_fix_auth_user_delete_cascade.sql`. The foundation includes private Storage bucket setup and policies, so the project must include Supabase Storage and Auth schemas. Both are already applied to the currently configured project; do not reapply them there.
3. Confirm the eight tables: `profiles`, `wardrobe_items`, `ai_tag_jobs`, `tag_suggestions`, `outfits`, `outfit_items`, `wear_logs`, and `outfit_feedback`.
4. Confirm Storage → `garment-photos` is private and permits only normalized `image/webp` files. The API accepts JPEG/PNG/WebP input and converts it before upload. The bucket limit is 8 MB.
5. Enable email/password Auth and configure the local Site URL/redirect URL as `http://127.0.0.1:5173`.
6. Put URL/public key in the frontend and API environments; put the server secret only in the API environment.
7. Restart the app, register, confirm the email if enabled, sign in and upload a real garment photo.

The migration filename was generated with `npx.cmd supabase migration new wardrobe_foundation`. If using CLI migration history instead of the SQL Editor, first discover your installed CLI's supported linking/push commands using `npx.cmd supabase --help` and the relevant subcommand's `--help`. The npm lockfile pins the resolved CLI version. Do not apply the same migration twice through different mechanisms.

The follow-up fix was approved by the user and recorded in Supabase's migration history as `20261019125355_fix_auth_user_delete_cascade`; the local filename matches that version. The original foundation was applied through SQL Editor and was not present in the remote migration-history listing. Before switching this existing project to CLI-driven migration management, reconcile that initial history explicitly; do not reset the database or blindly push the foundation again.

For an existing project, review table, policy, bucket and trigger names first. This is an initial schema, not a universal upgrade/reset script. It does not drop user tables. Existing Auth users should receive profile rows with this one-time administrator query if the project predates the migration:

```sql
insert into public.profiles(id)
select id from auth.users
on conflict(id) do nothing;
```

Check RLS using a SQL Editor query:

```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('profiles','wardrobe_items','ai_tag_jobs','tag_suggestions',
                   'outfits','outfit_items','wear_logs','outfit_feedback');

select id, public, file_size_limit, allowed_mime_types
from storage.buckets
where id = 'garment-photos';

select tablename, policyname, roles, cmd
from pg_policies
where schemaname = 'public'
   or (schemaname = 'storage' and tablename = 'objects');
```

All eight rows should have `rowsecurity = true`. The bucket's `public` field must be `false`. SQL Editor normally runs as an elevated role, so a successful administrator query is **not** an ownership test. The automated local tests switch to `authenticated` with distinct identities, and the opt-in live script uses separate real access tokens.

The migration explicitly grants table access to `authenticated`, then RLS limits access to the current owner. AI job completion/claim RPCs are executable only by `service_role`; user clients can enqueue only their own pending garments and cannot write AI suggestions or job outcomes. Composite foreign keys tie `user_id` to every garment/outfit association.

Supabase's [Data API exposure change](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically) makes explicit grants important. Keep `public` in the project's exposed API schemas and verify these grants if REST reads fail. Never solve a permissions problem by making the bucket public or disabling RLS.

Supabase Security Advisor was run against the configured project during live integration verification and again after the approved account-deletion fix. The remaining advisories and live results are documented in [live-verification.md](live-verification.md). Recheck the advisor before a future deployment. The default local SQL tests use PostgreSQL with emulated `auth` and `storage` schemas; they remain distinct from the recorded live-provider checks.
