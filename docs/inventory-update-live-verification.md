# Approved hosted inventory update — October 19, 2026

The user explicitly approved applying the tested forward migration. Supabase's migration tool applied its exact SQL successfully and recorded `20261019182024_wardrobe_inventory_update`. The local filename was aligned to that hosted version, from its original CLI-generated timestamp `20261019173835`; SQL contents did not change. SHA-256: `694fba4a4dc92004b8356ffa3143cd8861c082b75958d5970828714166eda4b7`.

No further migration command is required for the configured project. Do not reapply the update or blindly push the foundation, whose SQL-Editor application is still absent from migration history. Other projects need all three migration files in chronological order; see [database setup](database-setup.md).

## Preservation and schema checks

- Capability RPC returns `1`; all thirteen application tables have RLS enabled. The garment bucket remains private, restricted to WebP, with its 8 MB limit unchanged.
- Before application there was one account/profile and no wardrobe items, outfits, wear logs or feedback. The original profile fields' fingerprint matches after migration and after test cleanup. There was no populated user wardrobe against which to claim hosted inventory preservation; the populated upgrade regression is local PGlite evidence.
- The approved account-cleanup function's definition fingerprint is unchanged. Disposable account deletion succeeded with new collections, templates, import ledgers, saved outfits, wear logs and feedback present.
- After cleanup there is again one account/profile, zero rows in the other twelve application tables, and no garment-photo objects. No provided inventory was imported into the user's account.

## Live checks

The final [sanitized results](inventory-update-live-results.json) record **17 passed checks and successful cleanup**. `tests/verify-inventory-update-live.ts` runs the actual Express app, real Supabase password sessions, user-token/RLS database requests and private Storage. It uses disposable accounts, technical inventory fixtures and one neutral image swatch. It does not open a browser, test email delivery, call OpenAI or establish garment-recognition accuracy.

Covered: authenticated capabilities/inspiration; nullable-photo inventory and unknown metadata; collections and grouped quantities; Favorites and account isolation; Settings persistence; no-photo queue rejection; same-record private photo attachment, signed access and foreign/public denial; server pagination; source-keyed import preview; concurrent/repeated import and deletion tombstones; linking without metadata replacement; missing-component plans and editing; explicit manual completeness; owned-item enforcement; atomic outfit editing with retained wear/feedback; strict reviewed-set AI save validation; foreign association rejection; and final account/data/image cleanup.

The first two runs stopped at the combined edit/history assertion; both cleaned up successfully. The first attempt is retained in [its sanitized report](inventory-update-live-first-attempt.json). Live PostgREST returned the unique feedback relationship as an **object**, while the API/browser contract and test adapter expected an array. Saving, wearing and editing had succeeded, but feedback could not be read through the assumed shape. The API now normalizes object/null to array; the adapter models the actual to-one shape. The final run confirmed the live object shape and passed the retention assertion. No extra hosted SQL was needed for this correction.

Repeat only when intentionally running disposable live checks:

```powershell
npx.cmd tsx --env-file=apps/api/.env tests/verify-inventory-update-live.ts
```

This creates real temporary accounts and a private technical image, then deletes them. It writes only sanitized check names/results. Credentials, access tokens, signed URLs, account IDs and provider error payloads are not written to the report.

## Advisor findings and limits

The post-migration Security Advisor found the same three existing warning categories: anonymous and authenticated execute privileges on `public.rls_auto_enable()`, plus disabled leaked-password protection. The helper is an existing event-trigger function; the advisory alone is not evidence that it can be used as an ordinary RPC. No unrelated grants or Auth settings were changed. See [anonymous-function remediation](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [authenticated-function remediation](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) and [password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

Performance Advisor reported **eight informational missing-covering-index findings**: four on baseline `ai_tag_jobs`, `outfit_items` and `tag_suggestions` foreign keys, and four on new relationships: `item_collections(item_id,user_id)`, `item_collections(collection_id,user_id)`, `outfit_templates(user_id)` and `template_components(template_id,user_id)`. Existing owner-oriented indexes do not satisfy these exact covering-index checks. These remain a follow-up optimization; large-wardrobe performance was not measured. No additional index migration was applied under approval for the exact tested update. See [index guidance](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys).

The live run does not replace the isolated Chrome matrix, or rerun the earlier paid OpenAI/browser workflow. Physical devices, Safari/Firefox, screen readers, prolonged signed-URL expiry, real outages, worker concurrency, pilot targets and full security/accessibility audits remain unverified. No deployment, AWS provisioning, dependency update or measured duration is claimed.
