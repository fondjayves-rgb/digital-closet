import { z } from 'zod';

export const categories = ['tops', 'bottoms', 'dresses', 'outerwear', 'shoes', 'accessories', 'socks', 'underwear', 'sets', 'suits', 'afritude', 'headwear', 'sleepwear', 'after-shower', 'sports-equipment', 'fragrance'] as const;
export const categorySchema = z.enum(categories);
export const tagsSchema = z.object({
  category: categorySchema.nullable(),
  color: z.string().trim().min(1).max(60).nullable(),
  pattern: z.enum(['solid', 'striped', 'checked', 'floral', 'graphic', 'other', 'unknown']),
  attributes: z.array(z.enum(['long sleeves', 'short sleeves', 'sleeveless', 'collar', 'hood', 'buttons', 'zipper', 'pockets', 'visible logo'])).max(9),
}).strict();
export const reviewSchema = tagsSchema.extend({ name: z.string().trim().min(1).max(100), category: categorySchema, color: z.string().trim().min(1).max(60) });
export const requestSchema = z.object({ occasion: z.string().trim().min(1).max(120), style: z.string().trim().min(1).max(160), season: z.enum(['spring', 'summer', 'autumn', 'winter', 'all-season']) }).strict();
export const outfitSchema = z.object({ title: z.string().trim().min(1).max(100), explanation: z.string().trim().min(1).max(600), garmentIds: z.array(z.uuid()).min(1).max(8) }).strict();
export const recommendationsSchema = z.object({ suggestions: z.array(outfitSchema).max(3), inventoryNote: z.string().max(600) }).strict();
export const saveOutfitSchema = outfitSchema.extend({ occasion: requestSchema.shape.occasion, style: requestSchema.shape.style, season: requestSchema.shape.season });
export const feedbackSchema = z.object({ rating: z.number().int().min(1).max(5), comment: z.string().trim().max(500) }).strict();
export const wearSchema = z.object({ wornOn: z.iso.date() }).strict();
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
export const imageTypes = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type Tags = z.infer<typeof tagsSchema>;
export type Review = z.infer<typeof reviewSchema>;
export type OutfitRequest = z.infer<typeof requestSchema>;
export type OutfitSuggestion = z.infer<typeof outfitSchema>;
export type Recommendations = z.infer<typeof recommendationsSchema>;
export interface Garment extends Tags { id: string; user_id: string; name: string; status: 'pending' | 'confirmed'; photo_path: string | null; photoUrl?: string; created_at: string; updated_at: string; brand?: string | null; fit?: string | null; subtype?: string | null; quantity?: number | null; quantity_unit?: 'unspecified' | 'pieces' | 'pairs' | 'sets' | 'bottles'; pack_count?: number | null; pack_description?: string; source_description?: string; review_notes?: string; is_favorite?: boolean; set_coverage?: 'unspecified' | 'top-bottom'; collections?: string[]; }
export interface TagJob { id: string; item_id: string; status: 'queued' | 'processing' | 'retry' | 'succeeded' | 'failed' | 'cancelled'; attempts: number; last_error: string | null; }
export interface SavedOutfit { id: string; title: string; explanation: string; occasion: string; style: string; season: string; invalidated: boolean; created_at: string; updated_at?: string; creation_method?: 'ai' | 'manual'; outfit_items: { item_id: string }[]; outfit_feedback: { rating: number; comment: string }[]; }
export interface WearLog { id: string; outfit_id: string; worn_on: string; outfits: { title: string } | null; }

// A complete look contains a dress OR a top and bottom, plus shoes.
export function isCompleteLook(items: Pick<Garment, 'category' | 'set_coverage'>[]): boolean {
  const n = (c: string) => items.filter(i => i.category === c).length;
  if (items.some(i => !['tops','bottoms','dresses','outerwear','shoes','accessories'].includes(i.category || '') && !(['sets','suits'].includes(i.category || '') && i.set_coverage === 'top-bottom'))) return false;
  const sets = items.filter(i => ['sets','suits'].includes(i.category || '') && i.set_coverage === 'top-bottom').length;
  return n('shoes') === 1 && n('outerwear') <= 1 && n('accessories') <= 1 &&
    ((sets === 1 && !n('dresses') && !n('tops') && !n('bottoms')) || (!sets && ((n('dresses') === 1 && !n('tops') && !n('bottoms')) || (!n('dresses') && n('tops') === 1 && n('bottoms') === 1))));
}
export function validateRecommendations(value: unknown, inventory: Garment[], userId: string): Recommendations {
  const result = recommendationsSchema.parse(value);
  const allowed = new Map(inventory.filter(i => i.status === 'confirmed' && i.user_id === userId).map(i => [i.id, i]));
  const signatures = new Set<string>();
  for (const outfit of result.suggestions) {
    if (new Set(outfit.garmentIds).size !== outfit.garmentIds.length) throw new Error('An outfit contains duplicate garments.');
    const garments = outfit.garmentIds.map(id => { const item = allowed.get(id); if (!item) throw new Error('An outfit references an unavailable garment.'); return item; });
    if (!isCompleteLook(garments)) throw new Error('An outfit is missing a complete clothing combination and shoes.');
    const signature = [...outfit.garmentIds].sort().join(',');
    if (signatures.has(signature)) throw new Error('Outfit suggestions must use distinct garment combinations.');
    signatures.add(signature);
  }
  return result;
}

export function validateOutfit(value: unknown, inventory: Garment[], userId: string): OutfitSuggestion {
  const outfit = outfitSchema.parse(value);
  validateRecommendations({ suggestions: [outfit], inventoryNote: '' }, inventory, userId);
  return outfit;
}
export function lookCapacity(inventory: Garment[]): number {
  const n = (c: string) => inventory.filter(i => i.status === 'confirmed' && i.category === c).length;
  const sets = inventory.filter(i => i.status === 'confirmed' && ['sets','suits'].includes(i.category || '') && i.set_coverage === 'top-bottom').length;
  return (n('dresses') + sets + n('tops') * n('bottoms')) * n('shoes') * (n('outerwear') + 1) * (n('accessories') + 1);
}

const optionalText = (max: number) => z.string().trim().max(max).nullable().default(null);
export const inventorySchema = tagsSchema.extend({
  name: z.string().trim().min(1).max(100), category: categorySchema,
  brand: optionalText(100), fit: optionalText(80), subtype: optionalText(80),
  quantity: z.number().int().min(1).max(10000).nullable().default(null),
  quantity_unit: z.enum(['unspecified','pieces','pairs','sets','bottles']).default('unspecified'),
  pack_count: z.number().int().min(1).max(10000).nullable().default(null),
  pack_description: z.string().trim().max(300).default(''),
  source_description: z.string().max(2000).default(''), review_notes: z.string().max(1000).default(''),
  set_coverage: z.enum(['unspecified','top-bottom']).default('unspecified'),
  collections: z.array(z.string().trim().min(1).max(80)).max(12).default([]),
}).strict();
export type InventoryInput = z.infer<typeof inventorySchema>;
export const profileSchema = z.object({ display_name: z.string().trim().max(80), style_preferences: z.string().trim().max(160), gender: z.enum(['man','woman','nonbinary','self-described','prefer-not-to-say']).nullable().default(null), gender_description: z.string().trim().max(80).default(''), default_occasion: z.string().trim().max(120).default('') }).strict();
export type Profile = z.infer<typeof profileSchema>;
export const manualOutfitSchema = saveOutfitSchema.extend({ explanation: z.string().trim().max(600).default('A combination chosen by you.'), garmentIds: z.array(z.uuid()).min(1).max(20), confirmedComplete: z.literal(true) }).strict();
export function validateManualOutfit(value: unknown, inventory: Garment[], userId: string) {
  const result = manualOutfitSchema.parse(value);
  if (new Set(result.garmentIds).size !== result.garmentIds.length || result.garmentIds.some(id => !inventory.some(i => i.id === id && i.user_id === userId && i.status === 'confirmed'))) throw new Error('Choose distinct reviewed items from your own closet.');
  return result;
}
export interface OutfitTemplate { id: string; title: string; occasion: string; notes: string; template_components: { id: string; label: string; item_id: string | null }[]; }
export const templateSchema = z.object({ title: z.string().trim().min(1).max(100), occasion: z.string().trim().min(1).max(120), notes: z.string().max(2000), components: z.array(z.object({ label: z.string().trim().min(1).max(120), item_id: z.uuid().nullable() }).strict()).max(20) }).strict();
export const IMPORT_ID = 'provided-wardrobe-v1';
export interface ProvidedEntry { key: string; kind: 'item' | 'template'; section: string; source: string; warnings: string[]; item?: InventoryInput; template?: z.infer<typeof templateSchema>; }
