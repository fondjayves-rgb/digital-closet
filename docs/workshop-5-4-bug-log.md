# Workshop 5.4 Step 1 — bug log

Scope: current implementation audit and isolated systematic testing. Entries below distinguish **newly reproduced defects** from earlier work and unverified concerns. No personal wardrobe records or hosted configuration were changed. Severity describes user impact, not an unsupported security claim.

## New confirmed defects

### W54-BUG-001 — collections silently omitted on Enter submission

**Status: fixed and retested**, including all four configured Chrome widths.

- **Severity:** Medium — entered inventory metadata is silently omitted from the save.
- **Prerequisites:** signed-in isolated browser fixture; My Closet → Add without photo. The shared metadata field also appears in item review and import.
- **Reproduction:** enter a valid item name; check review confirmation; focus Collections last; type `Work, Daily, Work`; press Enter without moving focus out of the field.
- **Expected:** the submitted item and reopened field contain `Work` and `Daily`, once each.
- **Actual before fix:** POST contained `collections: []`. The original field updated parent state only on blur, which keyboard submission does not require.
- **Confirmation:** new focused desktop Playwright case failed at the outgoing-payload assertion, expected `['Work','Daily']`, received `[]`. This was not inferred solely from source inspection.
- **Fix:** [InventoryFields.tsx](../apps/web/src/InventoryFields.tsx) now keeps editable text and updates parsed/deduplicated collection state on every change. Blur only normalizes display text, so comma-separated typing and Enter submission both work.
- **Retest:** focused desktop regression passed, including reopening the saved record. Final four-width matrix result is recorded in [current results](workshop-5-4-results.json) and checklist W54-01. Broader numeric/collection limit and manual assistive-technology variants remain separately untested.
- **Evidence/method:** automated isolated Chrome, `tests/browser/workshop.spec.ts`, first scenario; no real Supabase/OpenAI call. Found and fixed during this assignment, not earlier work.

### W54-BUG-002 — removing a replacement target leaves stale replacement mode

**Status: fixed and retested**, including all four configured Chrome widths.

- **Severity:** Medium — the next item selection is ignored until the user discovers and cancels stale replacement mode.
- **Prerequisites:** signed-in fixture; Outfits → Build an outfit; reviewed inventory available.
- **Reproduction:** select Test shirt; activate Replace; activate Remove Test shirt while replacement is active; attempt to select Test trousers.
- **Expected:** removal cancels replacement immediately; trousers becomes a normal selection.
- **Actual before fix:** Cancel replacement remained visible even though the target was removed. The failing reproducer stopped at that assertion. Source inspection showed the next selection would map over the absent target and add nothing; successful next-selection recovery was actually exercised in the passing retest.
- **Confirmation:** new focused desktop Playwright case failed because the replacement-cancel control remained after removal (expected zero, received one). Source inspection of the handler confirmed the ignored-selection consequence.
- **Fix:** [ManualBuilder.tsx](../apps/web/src/ManualBuilder.tsx) now uses a removal handler that clears replacement when removing its target and still resets completeness confirmation.
- **Retest:** focused desktop regression passed, checking both removal of replacement mode and successful next selection. Final four-width matrix result is recorded in [current results](workshop-5-4-results.json) and checklist W54-02.
- **Evidence/method:** automated isolated Chrome, `tests/browser/workshop.spec.ts`, second scenario. Found and fixed during this assignment.

The two added scenarios reproduce distinct previously uncovered interactions. They do not duplicate the existing click-to-save collections or ordinary replace/remove tests merely to increase counts. Before-fix execution: **two failures**. Immediate post-fix desktop execution: **two passes**. Existing baseline regression execution: **52 passes**. Final full-run evidence is maintained separately rather than treating those prior results as proof of every control.

## Next phase — new confirmed defects

The next high-risk phase subsequently added the two confirmed findings below. W54-BUG-001/002 above remain Step1 history; they were retained in the full current regression matrix.

### W54-BUG-003 — overlapping Favorites requests lose pending state

**Status: fixed and retested** at 320/390/768/1440 px in the current full matrix.

- **Severity:** Medium — a still-pending card becomes interactive and permits redundant submissions; it also misrepresents save completion. No cross-account write or observed data loss is claimed.
- **Reproduction:** in isolated Closet, delay Favorite requests for two different cards. Favorite Test shirt, then Test trousers before either response arrives.
- **Expected:** each card stays disabled until its own operation settles; finishing one does not unlock the other.
- **Actual before fix:** Test shirt became enabled while both requests were pending. A single string tracked only the most recently clicked card; either completion cleared it for all cards.
- **Confirmation:** new desktop browser repro failed `toBeDisabled` for Test shirt after starting Test trousers, before any production change.
- **Fix:** `Closet.tsx` now tracks pending IDs in a Set and removes only the settled ID. Explicit persisted favorite values and failure recovery remain unchanged.
- **Retest/evidence:** `tests/browser/high-risk.spec.ts`, first scenario, passed at all four widths; assertions cover both outstanding requests and independent completion, with exactly two requests. Full [phase2 evidence](workshop-5-4-phase2-results.json) records 92 browser passes. This promotes the specific race from W54-CON-002 to a confirmed, resolved issue; it does not establish every arbitrary writer race.

### W54-BUG-004 — malformed edit timestamp reported as database outage

**Status: fixed and retested** in the isolated API/PostgreSQL suite.

- **Severity:** Low — invalid request metadata produced misleading recovery guidance; no overwrite or privilege bypass was observed.
- **Reproduction:** create a disposable manual outfit; PATCH it with `expectedUpdatedAt: "not-a-timestamp"` and otherwise valid fields.
- **Expected:** input-validation400 without modifying the outfit.
- **Actual before fix:** the API accepted any string, PostgreSQL timestamp conversion failed, and the generic database mapping returned503 Database unavailable.
- **Confirmation:** new local test expected400 and received503 before the fix.
- **Fix:** `features.ts` validates an optional ISO timestamp with timezone offsets before invoking SQL. Valid stored timestamps remain accepted; legacy omission remains compatible.
- **Retest/evidence:** `tests/high-risk.test.ts` verifies malformed400, a valid versioned edit and rejection of its now-stale previous version while current associations/history/feedback remain intact. All **65** current local regressions passed. No hosted schema/RPC change was required.

## Earlier implementation fixes — historical context

| Prior issue | Previously completed correction | Boundary |
| --- | --- | --- |
| Administrative account deletion with saved outfits failed | Approved cascade-trigger fix | Applied and verified before this assignment; no new hosted mutation here |
| To-one Supabase feedback object treated as array | API normalizes feedback object/null to the established array contract; adapter matches live shape | Previous live update verification; current local retention regression rerun separately |
| Photo-error timing race and planner result focus | Failed-photo state keyed to URL; generated heading receives focus | Previous quality review; existing Chrome scenarios rerun here |
| Upload replacement/status retry/initial failure presentation | Invalid replacement clears photo; corrections survive status retry; initial unavailable state distinguished from empty wardrobe | Previous quality work, not newly discovered defects |
| Manifest accidentally included brief rule paragraphs during development | Generator restricted to inventory sections; 86 inventory records and 14 templates | Previous implementation correction; no personal import performed by this audit |

## Unverified concerns and outstanding checks — not confirmed bugs

| ID | Concern or prerequisite | Why not a confirmed defect / next action |
| --- | --- | --- |
| W54-CON-001 | Closing upload/save dialogs while requests are in flight | Cancellation does not necessarily roll back a server write. Exercise delayed fixture responses and refresh before retry; AX-03/UP-05/VAL-15. No observed failure claimed. |
| W54-CON-002 | Rapid overlapping favorite writes on different cards | Promoted to confirmed W54-BUG-003 above; fixed and verified. Broader VAL-16 status/network combinations still remain untested. |
| W54-CON-003 | Expired sessions, offline/429/provider failures on every writer | Existing tests cover selected errors, not every writer/status combination. Complete AUTH-14/VAL-16 with controlled disposable sessions/fixtures. |
| W54-CON-004 | All option, text/numeric and 20-item boundaries | Individual schema and selected UI tests do not prove every browser field/options combination. Complete VAL/OPT cases. |
| W54-CON-005 | Real registration/email, worker/model and timed private-photo expiry | Seventeen fresh disposable Supabase checks passed without model/email calls. Actual email delivery and paid worker/model remain blocked; timed expiry is automatable but untested, not a manual prerequisite. |
| W54-CON-006 | Screen readers, physical devices, alternate browsers/zoom and complete WCAG review | Chrome's selected focus/contrast/width assertions are not exhaustive accessibility evidence. Complete AX cases. |
| W54-CON-007 | Previously recorded Supabase advisor findings | Fresh read-only scan confirmed the same three WARN categories/eight INFO index findings. Severity and proposed corrections are in the current security review. No hosted corrections or exploit/performance benchmark were performed. |

No unresolved **confirmed** defect is hidden in the concern list. A Not tested or Blocked checklist row is a coverage gap, not proof that its feature is broken. When reproducing an additional defect, add exact steps, safe evidence, severity, fix and an actual retest result before changing its status.
