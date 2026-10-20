# Wardrobe App navigation and wardrobe update

## Goal and working environment

Update the existing LoopWear Wardrobe App in VS Code with Codex on Windows. Preserve the working React/TypeScript/Vite frontend, Express API, Supabase accounts/database/private photos, OpenAI integration, and local worker. Inspect current source and documentation before editing. This is an authorized feature update before Workshop 5.4 testing resumes, not a new application or a deployment.

Keep the current visual identity and improve layouts as needed. Build all changes in this brief, run appropriate checks, and report actual results. Never display credentials or copy configured environment files into documentation or test artifacts. Use current official documentation when changing provider integrations.

## Primary navigation

Use this order on desktop and mobile:

1. Today
2. My Closet
3. Outfits
4. Favorites
5. Settings

Keep **Add a garment** as a prominent action, especially in My Closet. It should open the existing working upload flow. Provide a mobile layout that fits all five destinations with readable labels and usable targets.

Remove History from primary navigation, but preserve its records and functionality. Make wear history available as a secondary view within Outfits. Move the existing preferences entry into Settings and keep sign-out available there.

## Today

Make this the men's fashion trends and inspiration page, as specifically requested by the user. Keep it distinct from privately owned clothing.

- Display useful trend cards with a title, explanation, relevant category/style tags, source link, source publication date when available, and the date checked. Identify the region or scope when known.
- Research real current sources or connect a suitable permitted public feed. Do not ask OpenAI to invent what is currently trending. If using curated sources instead of an updating feed, visibly label the content **Curated men's style inspiration** and disclose the last checked date; do not claim live rankings or automatic freshness.
- Use permitted images with attribution where required, or an honest neutral illustration. Do not use retailer images without appropriate permission or label a generated image as an actual product photo.
- Distinguish source publication date from retrieval date. Do not refresh an old item's date to make it appear new.
- Explain unavailable/offline content and provide retry where meaningful. Do not fabricate trend cards or sources to fill an empty page.
- An optional **Build a look like this** action may open the outfit builder with style tags. It must use the user's inventory rather than pretend the inspiration item is owned.
- No purchases, affiliate checkout, or paid feed subscriptions are required.

## My Closet

- Show all of the signed-in user's wardrobe inventory, with category browsing, search, and filters by available metadata such as brand, color, fit, collection, and favorite status.
- Support the categories in the inventory below, including underwear, sports equipment, accessories, and fragrance. Do not restrict the entire inventory to tops, bottoms, and shoes.
- Keep garment upload, AI tag review, editing, deletion, and private photo access working.
- Display text-only inventory entries with a neutral category placeholder and **Add photo** action. Do not generate realistic photos and present them as the user's belongings.
- Support quantity, pack/set information, collections, and missing metadata without inventing attributes.
- Distinguish inventory record counts from physical-piece counts. Unknown quantities must not be treated as one confirmed item.

## Outfits

- Show the user's chosen and saved mix-and-match outfits.
- Add **Build an outfit** with a manual builder: select existing items, remove/replace items, name the combination, choose an occasion/style, preview actual photos or category placeholders, and save.
- Allow useful combinations with flexible categories, including complete suits, sports sets, and accessories. Do not force a separate top and bottom when a confirmed set is selected.
- Keep AI suggestions available as an optional action alongside manual creation. Preserve ownership and confirmed-inventory validation on both paths.
- Permit manual planning with reviewed text-only inventory; AI vision is unnecessary for manually entered items. Draft entries awaiting review must not be silently included in recommendations.
- Support editing, deletion, feedback, marking worn, and access to wear history where currently implemented. Persist records across refresh and sign-in.
- The sports combinations below are planning templates referencing wardrobe items. Their component lists do not prove that additional physical garments are owned. Show unmatched components as missing instead of fabricating owned items.
- Church, Outing, and Smoking remain editable planning placeholders, excluded from completed-outfit counts.

## Favorites

- Show only wardrobe items that the signed-in user has favorited, across all categories.
- Add an accessible favorite toggle on item cards/detail views. Toggling here or in My Closet must update both views and persist in the database.
- Support search/filtering and a useful empty state. Handle deleted items and failed saves consistently.
- Do not overload this page with trend bookmarks or outfit favorites; the requested scope is favorite wardrobe items.

## Settings

Organize existing and supported settings into understandable sections:

- Profile: editable display name and supported account details.
- Gender/style preferences: optional, user-editable values; allow an unset/prefer-not-to-say choice. Do not infer gender from photos, names, or clothing. Do not prevent browsing or wearing a category based on gender.
- Styling preferences: reuse working style/occasion preferences and add only values that affect the implemented outfit experience.
- Account: sign-out and existing supported account-management flows. Do not add inactive controls or promise unimplemented account deletion or password changes.
- Privacy/data: explain private photo storage and the use of OpenAI for user-requested analysis. Do not introduce analytics or expose individual wardrobes to LoopWear staff.

The Today page starts with men's inspiration as explicitly requested; account gender is not automatically set by that choice.

## Provided wardrobe inventory

This is user-provided inventory/planning data, not AI-recognized data. Preserve the original descriptions below in a reference file and create a deterministic import mapping. Do not run a global seed that affects every account.

Provide a one-time **Review provided wardrobe** flow for the signed-in user, with editing and selection before import. Preserve existing records and make repeated imports safe against duplication. Imported entries become confirmed only through explicit review/confirmation; no fabricated photographs, labels, or provider processing statuses.

Rules:

- Quantities are known only where explicitly stated. “Pack of 3” supplies a total count of three, but does not supply colors. “1 Pack” does not supply the number of pieces.
- Keep unknown brands/colors as unspecified. “Others” and “Specials” are descriptions, not evidence of a particular count.
- Do not automatically multiply sets into separate garments and also count the set itself. Support set/component relationships or keep an editable set record.
- Work, daily, and sports lists may refer to the same physical items. Flag potential overlaps for review, without automatically merging or creating additional copies.
- Preserve French/descriptive labels. Search aliases may include chemise = shirt, pantalon = trousers, kaki = khaki. “Thigh” is ambiguous; preserve it and request clarification within review rather than guessing.
- “Afritude” is the user's category. Do not infer garment construction or fit.
- Do not calculate a single definitive wardrobe total until unknown quantities and overlaps are resolved.

### Sandals

- Nike: 1 pair.
- Jordan: 1 pair.

### Socks

- Nike: 3 white, 3 black, 3 color.
- Jordan: 3 white, 3 black, 3 color.
- Zara/H&M: 1 black, 1 brown, 1 kaki, 1 beige, 1 gray. Brand allocation is unspecified.

### Underwear

- Calvin Klein: 2 black, 3 white, 2 gray, 2 colors.
- Nike: pack of 3.
- Jordan: pack of 3.

### Sleeveless shirts

- Nike: pack of 1.
- Jordan: pack of 1.

### Shorts

- Nike: pack of 1.
- Jordan: pack of 1.
- Others: 3 others.

### Tops

- Nike: pack of 3.
- Jordan: pack of 3.
- Others: pack of 3, no name.

### Bottoms

- Jeans, slim fit: 1 black, 1 sky blue.
- Jeans, baggy: 1 ripped black, 1 ripped blue.
- Joggers: kaki and gray, no name; quantities unspecified.
- Cargo: brown, baggy fit and slim fit; quantities unspecified.
- Cargo: army green, baggy fit and slim fit; quantities unspecified.

### Sports combination templates

- Day 1, Recovery + HIIT, Nike: shirt, Thigh, short, socks, shoes, towel. Match Orange Nike 5.
- Day 2, Weight Lift, Nike: top, underwear, bottom, socks, shoes, towel. Match White Kyrie.
- Day 3, Soccer, Nike: shirt, underwear, short, socks, shoes, towel. Match Blue Soccer Cleats.
- Day 4, Recovery + HIIT, Jordan: shirt, Thigh, short, socks, shoes, towel. Match Brown Jordan Shoes.
- Day 5, Weight Lift, Jordan: top, underwear, bottom (jogger), socks, shoes, towel. Match Jordan Low 1.
- Day 6, HIIT, Nobull: shirt, Thigh, short, socks, shoes, towel. Match Nobull Shoes.
- Day 7, Soccer, Team Jersey: underwear, socks, shin guard, shoes. Team Jersey.
- Extra Soccer: shirt, underwear, short, socks, shoes, towel. Match Green Nike Mercurial.
- Basketball: shirt, underwear, short, socks, shoes, towel. Match Black Kyrie Nike.
- Swimming: underwear, cap, glasses.
- Boxing: shirt, underwear, short, socks, shoes, towel. Match gloves.

### Jerseys

- Boston Celtics: beige, white, green, black; quantities unspecified.
- Barcelona: home and away; quantities unspecified.
- National: Cameroon, France, Spain; quantities unspecified.
- Inner wear for jersey: white, black, beige; no name, approximately Zara; brand not confirmed.

### Hoodies and jogger

- Nike: 1 pack; component count unspecified.
- Jordan: 1 pack; component count unspecified.

### Work collection

- Polos: 5 polos: black, army green, brown, 2 others.
- Chemises: 5 chemises: white, burgundy, gray, black, brown.
- Jeans: blue slim fit, kaki slim fit; quantities unspecified.
- Bottom: black, gray, brown; quantities unspecified.
- Underwear: 2 black CK, 2 gray CK, 2 brown CK.
- Socks: 2 black, 1 gray, 1 brown, 1 beige.
- Shoes: 1 black, 1 brown, 1 no-name sneaker.
- Belt: 1 black, 1 brown.

### Planned occasions

- Church: TBD.
- Outing: TBD.

### Suits and Afritude

- Normal suits: 1 black, 1 gray, 1 brown, 1 blue, Specials (unspecified).
- Smoking: TBD.
- Afritude: 1 white, 1 gold, 1 black.
- Ensemble jean: chemise + pantalon; quantity unspecified.
- All white: polo + pantalon, T-shirt + jean; quantities unspecified.

### Hats and caps

- Jordan black.
- Jordan red.
- ATL black.
- ATL blue red.
- Boston Celtics.
- Quantities unspecified for these entries.

### Shoes

Street wear:

- Nike: 5 pairs, individual models unspecified.
- Jordan: 5 pairs, individual models unspecified.
- Designer: Versace blue, Givenchy red, Givenchy blue; quantities unspecified.

Business casual:

- Sneaker: Versace black, Zara sneaker; quantities unspecified.
- Zara black 2, Zara brown 2.

Date night:

- Designer shoes: Alexander Mc Queen, LV, Dolce Gabbana; quantities unspecified.
- Zara black, Zara brown; quantities unspecified and may overlap other collections.

### Pajamas

- Ensemble white; quantity unspecified.
- Ensemble green; quantity unspecified.

### After shower cloth

- White; quantity unspecified.
- Green; quantity unspecified.

### Durags and bandanas

- Black, white, gray, burgundy, beige, gold, dark blue, sky blue, dark green, military green, brown.
- Quantities and assignment between durag/bandana are unspecified.

### Fragrance accessories

- Work perfume x1.
- Sport perfume x1.
- Home eau de toilette x1, day and night.
- Others: collections, unspecified.

## Persistence and implementation requirements

- Add additive migrations only where needed; do not reset the database or discard current wardrobes/outfits/history.
- Preserve user isolation on all new profile, favorite, inventory, import, outfit, and photo operations. Check ownership of related records at the API and database layers.
- Import data only into the active account with a deterministic import identifier and deduplication strategy. Preview records, preserve source labels, and report created/skipped/failed records.
- Keep the original garment photo/AI approval workflow while supporting manually confirmed inventory without photos.
- Model collections as flexible associations where appropriate: one physical garment may appear in Work and Date Night without being counted twice.
- Handle missing metadata explicitly in schema and UI. Do not feed uncertain entries to AI as confirmed facts.
- Keep server-side input validation, error states, loading indicators, keyboard access, and responsive layouts throughout.
- Avoid unnecessary dependencies. Add no paid services or external deployment.

## Verification and completion

Verify the new navigation; import preview and repeat-import behavior; favorites persistence and isolation; manual outfit save/edit and ownership validation; history retention; settings persistence; and the Add a garment flow. Test appropriate mobile and desktop widths, and run relevant regression checks, type checking, and production build.

For trend content, verify source URLs, dates, freshness labels, and unavailable states. Clearly identify curated versus live content and any incomplete provider connection.

Update the feature inventory and Workshop 5.4 checklist to cover every new control. Record actual checks and results, not invented passes. Do not claim this update makes the application production-ready or security-audited.

Finish with a concise implementation summary, migration/setup commands if needed, actual test results, remaining limitations, and the exact walkthrough to review the provided wardrobe and build/save a mix-and-match outfit.
