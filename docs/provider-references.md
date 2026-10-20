# Official integration references

Checked during implementation on October 19, 2026. Provider behavior and account access can change; use the installed lockfile plus current official documentation when upgrading.

| Topic | Official reference | Implementation use |
| --- | --- | --- |
| Supabase changes | [Changelog](https://supabase.com/changelog) | Checked relevant breaking-change notices; markdown index fetch failed, so the HTML index was used |
| Data API exposure | [Explicit table grants](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically) | Explicit `authenticated` grants alongside RLS |
| Password Auth | [Password-based Auth](https://supabase.com/docs/guides/auth/passwords) | `signUp`, `signInWithPassword` and confirmation handling |
| API token verification | [getUser](https://supabase.com/docs/reference/javascript/auth-getuser) | Server verification of every protected request |
| Sign-out | [signOut](https://supabase.com/docs/reference/javascript/auth-signout) | Real sign-out and documented token-expiry limits |
| Ownership | [RLS guide](https://supabase.com/docs/guides/database/postgres/row-level-security) | Owner policies, UPDATE checks, indexes and explicit grants |
| Private photos | [Storage access control](https://supabase.com/docs/guides/storage/security/access-control) | Owner-folder Storage policies |
| Signed access | [createSignedUrl](https://supabase.com/docs/reference/javascript/storage-from-createsignedurl) | Short-lived authorized photo access; batched signing in API |
| Structured AI | [Structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs) | `responses.parse`, `zodTextFormat`, null/refusal/incomplete handling |
| Image understanding | [Images and vision](https://developers.openai.com/api/docs/guides/images-vision) | Normalized image data input to Responses |
| Browser tests | [Playwright configuration](https://playwright.dev/docs/test-configuration) | Installed Chrome channel and desktop/mobile profiles |
| Patched image processing | [Sharp changelog](https://sharp.pixelplumbing.com/changelog/v0.35.5/) | Patched Sharp version selected after audit |
| Patched test tooling | [Vitest migration](https://vitest.dev/guide/migration/) | Verified Node/Vite prerequisites for the audit-driven upgrade |

These references informed implementation. Reading documentation is not live-provider verification, and no account/model availability claim is inferred from examples in the docs. `OPENAI_MODEL` must be selected by the developer for their own API account.
