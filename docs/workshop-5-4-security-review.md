# Workshop 5.4 next phase — read-only Supabase review

Reviewed October 19, 2026 using current Security/Performance Advisors and catalog/Storage SELECT queries. No table/record/configuration changes, Auth operations, signed URL generation or paid requests were performed. The [sanitized advisor record](workshop-5-4-advisor-results.json) preserves actual warning names, counts and remediation URLs. No credentials or personal wardrobe data were read into the report.

## Current observations

All **13 application tables have RLS enabled**. `garment-photos` is private, accepts `image/webp`, and retains its 8 MB limit. These are administrator metadata observations, not a new end-user RLS/Storage penetration test. Isolated tests exercise owner identities and SQL permissions separately. Earlier live account/photo checks remain historical evidence.

Security Advisor still reports three WARN categories: anonymous execution of a security-definer helper, authenticated execution of the same helper, and disabled leaked-password protection. Performance Advisor reports eight INFO foreign-key index findings. No new warning category was observed relative to the prior recorded scan.

## Helper execution grants — hardening priority, not a demonstrated HTTP exploit

`public.rls_auto_enable()` is `SECURITY DEFINER`, returns `event_trigger`, pins `search_path=pg_catalog`, and is attached to enabled event trigger `ensure_rls`. Its inspected body enables RLS on newly created public tables; it uses catalog objects and quoted identifiers. Anonymous and authenticated roles have execute privileges. The two advisor findings describe the same underlying function/grant issue.

My assessment: **medium hardening priority before deployment**, with the observed shape reducing the immediate risk relative to an ordinary privileged data-returning RPC. Neither `anon` nor `authenticated` currently has CREATE privilege on the public schema, as verified by a read-only catalog query. The warning should not be presented as proof of arbitrary anonymous SQL execution or cross-account data disclosure. An event-trigger return type/context is special; no HTTP exploit attempt or ordinary direct function call was executed in this phase. PostgreSQL describes this return type as signaling event-trigger invocation in its [event-trigger documentation](https://www.postgresql.org/docs/current/event-trigger-definition.html).

Recommended review-only correction:

```sql
-- Proposal only. Not applied. Requires approval and platform-owner review.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
```

Retain the platform helper and event trigger. Before applying, verify its owner/platform dependencies and test privileged table creation still enables RLS in an isolated PostgreSQL/Supabase branch. Then inspect execute privileges and rerun Advisor. Do not drop the trigger or broadly revoke all public RPCs: the app's intentionally authenticated invoker helpers must remain usable. Supabase's [function security/privilege guidance](https://supabase.com/docs/guides/database/functions#function-privileges) explains revoking both inherited PUBLIC access and explicit role grants. Advisor remediation links: [anonymous](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [authenticated](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).

## Leaked-password protection — account-security improvement

The current scan confirms protection is disabled. Assessment: **medium account-security risk**; this removes a defense against known-compromised passwords. It does not mean plaintext passwords are stored or that an account compromise was observed.

Recommended correction: with approval, enable leaked-password protection in Supabase Auth if the project's plan supports it; retain a sensible minimum password policy and retest new registration with disposable accounts. Current official documentation says leaked-password protection requires **Pro or above**. No project plan, paid upgrade or setting was changed, and no existing user's password was inspected. If unavailable on the current plan, record the limitation and use unique password-manager-generated passwords while deciding on future account hardening. See [official password-security guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Eight index findings — informational performance review

The flagged foreign keys are `ai_tag_jobs(item_id,user_id)`, `item_collections(collection_id,user_id)`, `item_collections(item_id,user_id)`, `outfit_items(outfit_id,user_id)`, `outfit_templates(user_id)`, `tag_suggestions(item_id,user_id)`, `tag_suggestions(job_id,item_id,user_id)` and `template_components(template_id,user_id)`.

Assessment: **low current severity / INFO**, with possible query and cascade-deletion cost as data grows; no performance failure or ownership bypass was measured. Review existing index definitions and actual query plans first. Some existing owner-leading composite indexes may serve the same equality predicates despite not satisfying the advisor's exact covering-index check. Avoid blindly adding eight redundant indexes. Add only justified indexes in a forward migration after local validation and explicit hosted-change approval; retain owner/composite foreign keys and RLS. See [Supabase index remediation](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys).

## Evidence boundaries and next actions

The markdown changelog fetch failed; the HTML changelog and current official function/password/PostgreSQL documentation were inspected. Some dynamic linter URLs were not retrievable by the web reader; they remain the remediation URLs returned by the live advisor. No SDK/model/dependency upgrades were introduced.

Inbox delivery/confirmation and physical-device or screen-reader experience require the user's environment. The current request authorizes safe disposable testing: seventeen fresh real Auth/database/Storage/API checks were executed separately from this read-only advisor review, using temporary accounts/records and one private technical image, then cleaned up. No personal records or hosted configuration changed. See [live results](workshop-5-4-live-results.json) and [aggregate preservation check](workshop-5-4-preservation-results.json).

Session expiry, timed photo expiry and real-browser account switching are technically automatable and have been reclassified Not tested, rather than incorrectly requiring manual involvement. They are not complete merely because current password sessions, fresh signed access and API/RLS isolation passed. A new OpenAI run requires explicit paid-operation approval and is intentionally omitted. Hosted grant/index/Auth-setting corrections still require explicit approval. The [checklist](workshop-5-4-testing-checklist.md) preserves these distinctions instead of promoting metadata observations to end-to-end provider passes.
