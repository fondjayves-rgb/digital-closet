# Feature inventory — wardrobe update

The preserved [update brief](../references/Wardrobe_App_Update_Brief.md) controls this update. Existing React/Vite, Express, Supabase Auth/private Storage and local-worker architecture remain in place. The user-approved database update is applied at version `20261019182024`; seventeen real API/Supabase checks and cleanup passed. No inventory was imported into the user's account. See [hosted evidence](inventory-update-live-verification.md) and the [Workshop 5.4 checklist](workshop-5.4-testing-checklist.md) for individual controls and evidence boundaries.

| Area | Implemented behavior | Persistence / boundary |
| --- | --- | --- |
| Navigation | Today, My Closet, Outfits, Favorites, Settings, in that order; five mobile targets; header account shortcut; upload action | Navigation is local view state; no new routing dependency |
| Today | Four curated US/international style cards, source links, separate publication/check dates, scope/tags, neutral illustrations, failure/retry | Authenticated `/api/inspiration`; maintained catalog, no live feed, ranking, retailer photos or AI-generated trend claims |
| Inventory | Six original categories plus socks, underwear, sets, suits, Afritude, headwear, sleepwear, after-shower, sports equipment and fragrance; flexible subtypes | Original records/IDs retained; unknown quantities/attributes remain nullable |
| Browsing | Search with chemise/shirt, pantalon/trousers and kaki/khaki aliases; category, status, brand, color, fit, subtype, collection, favorite filters; sort; load more | Server-filtered pages, 100 default / 200 maximum; app loads successive pages for its planning inventory |
| Manual items | Reviewed text records without photos; brand/fit, quantity/unit, packs, notes and collections | Explicit confirmation; no photo or OpenAI job required |
| Photos | Existing upload/AI review retained; attach normalized private photo to an existing text record | Attachment does not create a new item, reset confirmation or enqueue AI; existing-photo replacement is rejected |
| Import | Preview **86 inventory records + 14 planning templates**; select/edit/review; overlap decisions; link existing records; ten-entry batches; created/linked/skipped/failed report | Per-account `provided-wardrobe-v1` ledger, stable source keys, transaction locking and uniqueness; deletion leaves a deduplication tombstone |
| Sets/counts | Single editable set/group records; explicitly reviewed top-bottom coverage for AI eligibility | No expansion into invented garments; known quantities reported by unit, never as a definitive physical wardrobe total |
| Collections | One item associated with multiple named collections; names entered as comma-separated values | Owner-scoped collection and association rows; linking an import adds collections without replacing existing item metadata |
| Favorites | Explicit favorite/unfavorite buttons in Closet, Favorites and item detail, search/filters, empty state, failure recovery | Boolean on the owned item; unrelated trend/outfit bookmarking is excluded |
| Manual outfits | Select/remove/replace 1–20 reviewed owned records, name, occasion/style/season/notes, photo/placeholder preview, explicit completion confirmation | Atomic save/update; flexible categories, no imposed everyday clothing rule; user does not save unfinished manual looks |
| AI suggestions | Optional existing structured-output workflow, with explicitly reviewed full-set eligibility | Strict complete-look/ID validation at UI/API/database; no automatic purchases or inferred missing attributes; existing AI limit of 500 reviewed records remains |
| Templates | Separate sports plans and Church/Outing/Smoking placeholders; edit labels/notes, match/remove/add components, save/delete, create a finished look | Missing slots stay missing; no extra inventory created; unfinished templates excluded from outfit counts and wear recording |
| Saved outfits/history | Edit, delete with confirmation, feedback, explicit wear date, history under Outfits, remove wear record with confirmation | Editing retains existing wear/feedback rows; garment deletion invalidates affected saved outfits while retaining history |
| Settings | Display name, read-only email, optional gender/unset/prefer-not-to-say/self-description, style, default occasion, save/retry, sign-out, privacy explanation | Owned profile; defaults prefill both builders; gender is never inferred and never gates a category |
| Compatibility | Missing-update capability message; legacy inventory read/upload/tag review, AI outfits, preferences and history remain usable before migration | New persistent features remain disabled until `/api/capabilities` confirms the migration marker |

## Mapping provenance

`scripts/build-provided-inventory.mjs` deterministically generates `packages/shared/src/provided-inventory.json` from the entire preserved brief. Run `node scripts/build-provided-inventory.mjs` from PowerShell to regenerate the same manifest; this writes only the manifest, not the database. Rules before the inventory headings and the hats quantity note are instructions, not owned records.

Explicitly counted color variants are separated where supported; ambiguous grouped descriptions remain grouped. For example, the Work chemise/polo groups retain their stated total of five and original color lists without assigning an invented count to each color. A pack of three records three pieces but no guessed colors; “1 Pack” records one pack with unknown component quantity. Sock quantities without explicit pair/piece units keep an unspecified unit. “Thigh” occurs only as a template slot requiring clarification. “Approximately Zara” and Zara/H&M allocation remain unconfirmed brands. No import occurs automatically or across accounts.

## Service contracts added

- `GET /api/capabilities`, `GET /api/inspiration`.
- `GET /api/items` adds offset/limit, metadata/favorite filters, total/nextOffset and quantity summary. Existing response `items` remains.
- `POST /api/items/manual`, `POST /api/items/:id/photo`, `PATCH /api/items/:id/favorite`.
- Existing item PATCH/confirmation accepts the extended metadata schema; legacy tag-only bodies remain supported.
- `GET /api/import/preview`, `POST /api/import/commit` (1–10 explicitly reviewed decisions).
- `GET /api/templates`, `PATCH /api/templates/:id`, `DELETE /api/templates/:id`.
- `POST /api/outfits/manual`, `PATCH /api/outfits/:id`; original AI save endpoint retained.
- Profile PATCH adds optional gender/description/default occasion while retaining legacy name/style updates.

All private operations validate the session and use the user's token/RLS. Database helpers use invoker security; new relationships enforce matching owners. Worker jobs require an actual pending photo. No new provider credentials or dependencies are required.
