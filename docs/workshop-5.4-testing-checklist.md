# Workshop 5.4 testing checklist — navigation/inventory update

Historical update-specific worksheet. For the subsequent Workshop 5.4 Step 1 audit, use [the systematic checklist](workshop-5-4-testing-checklist.md) and [bug log](workshop-5-4-bug-log.md). Statuses below are earlier evidence, not new manual acceptance results.

This is a control-by-control acceptance checklist, not a fabricated tester study. The user brief is preserved in `references/Wardrobe_App_Update_Brief.md`. Every added or changed control is listed below, including shared fields and repeated controls identified by their label/category/item.

**Evidence key:** B0 = protected workflow in `wardrobe.spec.ts`; B1–B6 = the six scenarios, in order, in `features.spec.ts`; Q1–Q5 = the five quality scenarios, in order, in `quality.spec.ts`. These run with isolated provider/API responses. API/SQL = local Express/PGlite tests. **M = manual verification not performed**, or an individual option/error variant not specifically asserted. A B reference describes an exercised scenario, not a claim that every possible error variant or keyboard interaction passed.

For each control, Workshop testers should record actual date, browser/device, result, issue and supporting evidence. Common keyboard acceptance: reachable visible focus, Enter/Space activation, native arrow-key selection, checkbox/radio labels, no keyboard trap outside the active native dialog, and restored focus on exit. Screen-reader output and physical-device testing remain manual even where browser focus assertions pass.

| Run | Actual result |
| --- | --- |
| Local API/database/schema regression | **52 passed**, including the populated upgrade and extended cascade; no hosted provider claim |
| Browser matrix: 320 / 390 / 768 / 1440 px | **56 passed**, fourteen isolated Chrome scenarios per width; fixture responses |
| Workshop participants / completion percentages | Not measured; no pilot result claimed |
| New hosted migration / live new-feature workflow | Applied; **17 live API/Supabase checks and cleanup passed**, without browser/email/model calls; [evidence](inventory-update-live-verification.md) |

## Shared navigation

| Control ID | Control | Expected behavior / failure check | Evidence / remaining work |
| --- | --- | --- | --- |
| NAV-01 | Today | Open curated inspiration | B1 |
| NAV-02 | My Closet | Open owned inventory | B2/B4/B6 |
| NAV-03 | Outfits | Open saved looks, plans and wear history | B3/B4 |
| NAV-04 | Favorites | Show only favorited wardrobe items | B2 |
| NAV-05 | Settings | Open supported profile/account settings | B5 |
| NAV-06 | Header account shortcut | Open Settings; no preferences modal remains | B0 |
| NAV-07 | Refresh wardrobe | Show progress, disable duplicate clicks, refresh private data/photos | Q2 |
| NAV-08 | Global Retry | Recover a failed initial data load | Q4 |
| NAV-09 | Skip to content | Keyboard focus moves to main content | M |
| NAV-10 | Notification dismiss | Dismiss the current status notification | M |

## Today

| Control ID | Control | Expected behavior / failure check | Evidence / remaining work |
| --- | --- | --- | --- |
| TOD-01 | Color accent source link | Open real GQ source separately; publication and checked dates remain distinct | B1 |
| TOD-02 | Field jacket source link | Open same dated editorial source, without product checkout | B1 |
| TOD-03 | Heritage source link | Open dated expert outlook; label it a forecast | B1 |
| TOD-04 | Precise silhouette source link | Open official Prada PDF; publication date stays unspecified | B1 |
| TOD-05 | Retry inspiration | Recover failed catalog retrieval; never regenerate checked dates | B1 |

## My Closet and Favorites

| Control ID | Control | Expected behavior / failure check | Evidence / remaining work |
| --- | --- | --- | --- |
| CL-01 | Add a garment (sidebar/page/empty state) | Open original private upload flow | B0/Q3 |
| CL-02 | Add without photo | Open reviewed manual entry form | B2 |
| CL-03 | Review provided wardrobe | Open explicit import preview | B4 |
| CL-04 | Review pending pieces | Clear incompatible filters and show pending records | M |
| CL-05 | Search your closet | Search names/available metadata; server supports French aliases | B0/B6; API aliases |
| CL-06 | Review status | Filter reviewed/pending/all records | B6 |
| CL-07 | Sort garments | Sort by name/newest/oldest | B6 name; M oldest |
| CL-08 | Brand filter | Filter available reviewed brands | B6 |
| CL-09 | Color filter | Filter known colors; unknown values stay unknown | B6 |
| CL-10 | Fit filter | Filter user-entered fits | B6 |
| CL-11 | Subtype filter | Filter subtypes without narrowing all inventory to clothing | B6 |
| CL-12 | Collection filter | One record remains one record across multiple collections | B6; API associations |
| CL-13 | Favorites only | Filter favorited records within Closet | B2 |
| CL-14 | Clear filters (toolbar/empty state) | Clear query/metadata/status/category; Favorites retains favorite scope | B6 toolbar; M empty action |
| CL-15 | Load more items | Append next page without dropping earlier records | B6 |
| CL-16 | Item detail button | Open review/edit dialog without nested favorite buttons | Q1; B2 |
| CL-17 | Favorite/unfavorite on cards | Persist explicit state in Closet/Favorites; failed save retains state | B2 |
| CL-18 | Add photo on text records | Attach to same owned ID, retain confirmation/metadata | B2; API |
| CL-19 | Retry inventory | Retry failed filtered inventory request | M |
| CL-CAT-all | All pieces | Filter this category; empty category remains truthful | B6 |
| CL-CAT-tops | tops | Filter this category; empty category remains truthful | B6 |
| CL-CAT-bottoms | bottoms | Filter this category; empty category remains truthful | B6 |
| CL-CAT-dresses | dresses | Filter this category; empty category remains truthful | B6 |
| CL-CAT-outerwear | outerwear | Filter this category; empty category remains truthful | B6 |
| CL-CAT-shoes | shoes | Filter this category; empty category remains truthful | B6 |
| CL-CAT-accessories | accessories | Filter this category; empty category remains truthful | B6 |
| CL-CAT-socks | socks | Filter this category; empty category remains truthful | B6 |
| CL-CAT-underwear | underwear | Filter this category; empty category remains truthful | B6 |
| CL-CAT-sets | sets | Filter this category; empty category remains truthful | B6 |
| CL-CAT-suits | suits | Filter this category; empty category remains truthful | B6 |
| CL-CAT-afritude | afritude | Filter this category; empty category remains truthful | B6 |
| CL-CAT-headwear | headwear | Filter this category; empty category remains truthful | B6 |
| CL-CAT-sleepwear | sleepwear | Filter this category; empty category remains truthful | B6 |
| CL-CAT-after-shower | after-shower | Filter this category; empty category remains truthful | B6 |
| CL-CAT-sports-equipment | sports-equipment | Filter this category; empty category remains truthful | B6 |
| CL-CAT-fragrance | fragrance | Filter this category; empty category remains truthful | B6 |

## Upload, review and shared inventory fields

| Control ID | Control | Expected behavior / failure check | Evidence / remaining work |
| --- | --- | --- | --- |
| ITEM-01 | Choose a photo / Choose a different photo | Choose supported file; invalid replacement clears prior selection | Q3 |
| ITEM-02 | Drop one photo | Accept one supported file; reject multiple/empty/oversized files | M browser; API validation |
| ITEM-03 | Upload & review | Retain valid file on failure; retry without silently approving tags | B0/Q3 |
| ITEM-04 | Item name / Garment name | Require a nonblank reviewed name | B2/B4/Q3 |
| ITEM-05 | Category | Explicitly choose supported category; no gender gating | B0/B2/B4 |
| ITEM-06 | Color / Main color | Store known color or explicit unknown | B0/Q3; API null |
| ITEM-07 | Color is unspecified | Allow intentional null color in metadata-aware review | B2 |
| ITEM-08 | Pattern | Store only supported reviewed pattern | M |
| ITEM-ATTR-01 | long sleeves checkbox | Store only the visible detail explicitly chosen by reviewer | M; API allowed schema |
| ITEM-ATTR-02 | short sleeves checkbox | Store only the visible detail explicitly chosen by reviewer | M; API allowed schema |
| ITEM-ATTR-03 | sleeveless checkbox | Store only the visible detail explicitly chosen by reviewer | M; API allowed schema |
| ITEM-ATTR-04 | collar checkbox | Store only the visible detail explicitly chosen by reviewer | M; API allowed schema |
| ITEM-ATTR-05 | hood checkbox | Store only the visible detail explicitly chosen by reviewer | M; API allowed schema |
| ITEM-ATTR-06 | buttons checkbox | Store only the visible detail explicitly chosen by reviewer | M; API allowed schema |
| ITEM-ATTR-07 | zipper checkbox | Store only the visible detail explicitly chosen by reviewer | M; API allowed schema |
| ITEM-ATTR-08 | pockets checkbox | Store only the visible detail explicitly chosen by reviewer | M; API allowed schema |
| ITEM-ATTR-09 | visible logo checkbox | Store only the visible detail explicitly chosen by reviewer | M; API allowed schema |
| ITEM-09 | Brand | Allow known brand or unspecified; no vision inference | B2 |
| ITEM-10 | Fit (entered by you) | Preserve user text without claiming photo inference | B2 |
| ITEM-11 | Subtype | Store flexible subtype | B2 |
| ITEM-12 | Known quantity | Allow unknown; otherwise positive bounded integer | M UI entry; API bounds |
| ITEM-13 | Quantity unit | Keep unknown unit distinct from pieces/pairs/sets/bottles | M; API |
| ITEM-14 | Known pack count | Record packs separately from unknown component quantity | B2 |
| ITEM-15 | Pack / set description | Preserve grouping without creating components | B2 |
| ITEM-16 | Reviewed set coverage | Only explicit top-bottom coverage qualifies sets for AI | M UI; API/SQL set tests |
| ITEM-17 | Collections (comma separated) | Create flexible associations; reject invalid/too many values | B2; API associations |
| ITEM-18 | Review notes | Preserve clarifications rather than inferred facts | B2 |
| ITEM-19 | Manual inventory review confirmation | Required before confirming new text inventory | B2; API |
| ITEM-20 | Confirm & save item | Save owned confirmed text record without provider processing | B2 |
| ITEM-21 | Suggest tags with AI / Retry analysis | Queue only an owned pending photo; status errors stay recoverable | M live after update; original API regression |
| ITEM-22 | Retry status check | Retry failed polling without losing user edits | Q3 |
| ITEM-23 | Apply AI tags again | Explicitly reapply proposal after edits | M |
| ITEM-24 | Confirm & add to my closet / Save changes | Validate reviewed details and preserve ownership | B0/Q3 |
| ITEM-25 | Delete garment / Delete permanently / Keep garment | Confirm destruction; affected looks invalidated, history retained | M UI; API/SQL deletion |
| ITEM-26 | Favorite item / Unfavorite item in detail | Persist same item favorite state as cards; retain state on failed save | B2 toggle; M detail-specific failure injection |

## Provided inventory review/import

| Control ID | Control | Expected behavior / failure check | Evidence / remaining work |
| --- | --- | --- | --- |
| IMP-01 | Section selector | Filter descriptions without dropping selections | B4 |
| IMP-02 | Search descriptions | Filter preserved source labels | M |
| IMP-03 | Select source entry | Select only not-yet-imported rows; imported tombstones remain disabled | B4 |
| IMP-04 | Review details / Close details | Expand one editable description and warnings | B4 via selection; M explicit toggle |
| IMP-05 | Import decision | Explicit separate/link/skip decision; unresolved overlap blocks import | B4 separate; API link/skip/dedupe |
| IMP-06 | Existing item | Link only reviewed owned matching candidates; do not overwrite its metadata | M UI; API ownership/link |
| IMP-07 | Shared item fields | Edit source proposal using ITEM fields; original source remains visible | B4 name; remaining fields as above |
| IMP-08 | Template name | Edit proposed template title | M |
| IMP-09 | Per-entry review confirmation | Editing resets confirmation; unknowns need not be invented | B4 |
| IMP-10 | Import selected reviewed entries | Require reviewed choices; ten-entry batches; truthful per-entry result | B4; API batch/concurrency |
| IMP-11 | Retry preview | Recover preview failure without auto import | M |
| IMP-12 | Done reviewing / Close dialog | Exit without importing unsubmitted choices | B4/Q1 |

## Outfit creation and saved looks

| Control ID | Control | Expected behavior / failure check | Evidence / remaining work |
| --- | --- | --- | --- |
| OUT-01 | Saved outfits view | Show completed saved looks; exclude templates | B3 |
| OUT-02 | Planning templates view | Show plans separately from completed outfits | B4 |
| OUT-03 | Wear history view | Retain secondary access to existing logs | B0/B3/Q5 |
| OUT-04 | Build an outfit / Build your first outfit | Open manual selection of reviewed owned records | B3 |
| OUT-05 | Suggest with AI | Open optional original AI planner | B0/Q5/B5 |
| OUT-06 | Outfit name | Require a meaningful finished-look name | B3; schema trim |
| OUT-07 | Occasion | Prefill saved preference; allow per-look choice | B5 |
| OUT-08 | Style | Prefill saved preference; allow per-look choice | B5 |
| OUT-09 | Season | Persist supported season | M manual selector; API enum |
| OUT-10 | Outfit notes | Persist user-written explanation | M manual editor; API |
| OUT-11 | Search reviewed items | Search picker without admitting pending drafts | B3 |
| OUT-12 | Item category | Filter picker categories | B3 |
| OUT-13 | Item collection | Filter picker by flexible collections | M |
| OUT-14 | Picker select/deselect | Select distinct reviewed owned records, at most twenty | B3; API ownership/duplicates |
| OUT-15 | Replace selected item | Replace selected ID from picker | B3 |
| OUT-16 | Cancel replacement | Exit replacement without modifying selected IDs | M |
| OUT-17 | Remove selected item | Remove only this selection | B3 |
| OUT-18 | Finished outfit confirmation | Required explicit completeness decision; no auto saved draft | B3; API false rejection |
| OUT-19 | Save finished outfit | Atomically save flexible combination | B3; API/SQL |
| OUT-20 | Saved outfit card | Open actual photos/placeholders and owned details | B0/B3 |
| OUT-21 | Edit outfit | Open existing selection and metadata | B3 |
| OUT-22 | Save outfit changes | Atomic replace, retain wear/feedback records; reject stale/foreign IDs | B3; API/SQL retention |
| OUT-23 | AI occasion/style/season fields | Validate request and use only reviewed inventory | Q5/B5; M season option traversal |
| OUT-24 | Find my outfits / Try a fresh set | Loading/error/retry; no invented owned IDs | B0/Q5 |
| OUT-25 | Save this outfit | Save validated AI combination once per displayed suggestion | B0 |

## Planning template controls

| Control ID | Control | Expected behavior / failure check | Evidence / remaining work |
| --- | --- | --- | --- |
| TPL-01 | Review template | Open original plan and missing-component slots | B4 |
| TPL-02 | Template name | Edit title without creating owned items | M |
| TPL-03 | Template occasion | Edit planning occasion | M |
| TPL-04 | Template notes | Preserve/clarify source planning text including Thigh | M |
| TPL-05 | Component label | Clarify ambiguous requirement | B4 |
| TPL-06 | Match component | Choose reviewed owned item or keep missing | B4; API foreign rejection |
| TPL-07 | Remove component | Explicitly remove a planning requirement | B4 |
| TPL-08 | Add component | Add unmatched slot; finished action becomes unavailable | B4 |
| TPL-09 | Save template | Persist plan separately; no completed-outfit count increase | B4; API |
| TPL-10 | Create finished outfit | Enabled only for matched nonempty plan; open manual confirmation | B4 |
| TPL-11 | Delete template / Keep template / Delete template permanently | Confirm removal without deleting owned inventory or completed outfits | B4 |

## Wear, feedback and dialog controls

| Control ID | Control | Expected behavior / failure check | Evidence / remaining work |
| --- | --- | --- | --- |
| HIST-01 | Date worn | Require valid nonfuture date | B0/B3 default date; API future-date validation |
| HIST-02 | I wore this outfit | Record explicit owned available finished outfit wear | B0/B3; API |
| HIST-03 | Rating 1–5 radio options | Accessible labeled group; persist selected rating | B0 5 stars; M other options |
| HIST-04 | A note for next time | Bounded user feedback comment | M UI; API |
| HIST-05 | Save feedback | Persist owned rating/comment; show status/error; retain saved feedback after outfit edit/reload | B0; API; live persistence/response-shape correction |
| HIST-06 | Delete saved outfit / Delete outfit / Keep it | Confirm outfit/history/feedback cascade; inventory remains | M UI; API/SQL |
| HIST-07 | View outfit in history | Open corresponding saved outfit | M |
| HIST-08 | Remove wear record / Remove record / Keep it | Confirm log-only deletion or retain on cancel | B3 |
| DIALOG-01 | Close dialog button | Close the active dialog and restore connected opener focus | Q1/B4 |
| DIALOG-02 | Escape / backdrop outside content | Escape closes with focus restored; backdrop click only outside content | Q1 Escape; M pointer backdrop |

## Settings

| Control ID | Control | Expected behavior / failure check | Evidence / remaining work |
| --- | --- | --- | --- |
| SET-01 | Display name | Persist owned editable name | B5 |
| SET-02 | Email address | Read-only account email, no inactive change promise | B5 |
| SET-03 | Gender (optional) | Unset/prefer-not-to-say/self-described values; never infer or gate categories | B5 unset/prefer-not-to-say; M remaining options |
| SET-04 | Your description | Only shown for self-described value; clear when changing away | M |
| SET-05 | Your style preferences | Persist and prefill both builders | B5 |
| SET-06 | Default occasion | Persist and prefill both builders | B5 |
| SET-07 | Save settings | Retain edits on failure; retry and persist across reload | B5 |
| SET-08 | Sign out | SDK sign-out, clear private view and return to account screen | B0 |

## Separate live API evidence

The final live runner exercised the service behavior behind CL-02/08/12/13/15/17/18, ITEM-06/12/13/14/16/17/19/20, IMP-03/05/06/09/10, OUT-01/18/19/22, TPL-06/09, HIST-02/05 and SET-01/03/05/06/07. It also checked authenticated inspiration retrieval, ownership boundaries, concurrent imports, deletion tombstones and cleanup. These are seventeen scripted API/provider checks, not seventeen UI tests or a claim that every control variant passed live. Keyboard/failure statuses in the individual rows remain as recorded. See [results](inventory-update-live-results.json) and [boundaries/advisors](inventory-update-live-verification.md).

## Workshop execution notes

- Verify destructive controls with disposable test records, preserving the user's actual inventory. Test another account for all relationships, favorites/imports and private photos.
- Check input bounds, blanks, offline/provider failures and explicit retries; a successful startup is not functional evidence. Refresh before retrying a timed-out upload/save.
- Verify unknown quantities, unspecified units, grouped packs/sets, potential overlaps, French source labels and missing sports components. Do not turn placeholders into owned records.
- Check curated source URLs/dates against publishers separately from fixture tests. A catalog retry must retain source dates and never claim a live feed.
- Revisit every M entry above on physical mobile devices and assistive technology. Record failures and fixes without filling in unperformed passes.
- The proposed ten-tester/eighty-percent and recognition-accuracy targets remain unmeasured. No production-readiness or security-audit conclusion follows from this checklist.

