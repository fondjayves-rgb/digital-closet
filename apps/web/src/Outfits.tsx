import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Sparkles, ArrowRight, Bookmark, Check, Star, Trash2 } from 'lucide-react';
import { type Garment, type OutfitRequest, type OutfitSuggestion, type Recommendations, type SavedOutfit, requestSchema, validateRecommendations, lookCapacity } from '@wardrobe/shared';
import { api, message, localDate } from './lib';
import { Modal, GarmentPhoto } from './ui';
export function Collage({ ids, items }: { ids: string[]; items: Garment[] }) {
  const garments = ids.map(id => items.find(i => i.id === id)).filter((i): i is Garment => Boolean(i));
  return <div className={`outfit-collage pieces-${Math.min(garments.length,4)}`}>{garments.map(i => <div className={`collage-piece cat-${i.category}`} key={i.id}><GarmentPhoto item={i}/></div>)}</div>;
}
export function Planner({ items, userId, initialStyle, initialOccasion, onClose, onSaved }: { items: Garment[]; userId: string; initialStyle: string; initialOccasion?:string; onClose(): void; onSaved(): void }) {
  const [request, setRequest] = useState<OutfitRequest>({ occasion: initialOccasion || 'Everyday', style: initialStyle || 'Relaxed and simple', season: 'all-season' });
  const [result, setResult] = useState<Recommendations | null>(null); const [usedRequest, setUsedRequest] = useState<OutfitRequest>(request);
  const [busy, setBusy] = useState(false); const [saving, setSaving] = useState<number | null>(null); const [saved, setSaved] = useState<number[]>([]); const [error, setError] = useState('');
  const resultsHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (result) resultsHeading.current?.focus(); }, [result]);
  async function generate(event: FormEvent) {
    event.preventDefault(); setError('');
    const parsed = requestSchema.safeParse(request);
    if (!parsed.success) { setError('Enter an occasion and your style preferences before finding outfits.'); return; }
    setBusy(true); setResult(null); setSaved([]);
    try {
      const value = await api<Recommendations>('/outfits/suggest', { method: 'POST', body: JSON.stringify(parsed.data) });
      setResult(validateRecommendations(value, items, userId)); setUsedRequest(parsed.data);
    } catch (err) { setError(message(err)); } finally { setBusy(false); }
  }
  async function save(outfit: OutfitSuggestion, index: number) {
    setSaving(index); setError('');
    try { await api('/outfits', { method: 'POST', body: JSON.stringify({ ...outfit, ...usedRequest }) }); setSaved(v => [...v,index]); onSaved(); }
    catch (err) { setError(message(err)); } finally { setSaving(null); }
  }
  const capacity = lookCapacity(items);
  return <Modal title="Fresh ways to wear your favorites." subtitle="A little inspiration, made entirely from your confirmed closet." onClose={onClose} wide>
    <form className="planner-form" onSubmit={generate}><div className="form-row"><label>What’s the occasion?<input value={request.occasion} onChange={e => setRequest(v => ({ ...v, occasion: e.target.value }))} required maxLength={120} placeholder="Coffee, class, a day at the office…"/></label><label>Season<select value={request.season} onChange={e => setRequest(v => ({ ...v, season: e.target.value as OutfitRequest['season'] }))}>{['all-season','spring','summer','autumn','winter'].map(s => <option key={s} value={s}>{s[0].toUpperCase()+s.slice(1)}</option>)}</select></label></div><label>Your style preferences<input value={request.style} onChange={e => setRequest(v => ({ ...v, style: e.target.value }))} required maxLength={160} placeholder="e.g. Minimal, comfortable, earth tones"/></label>
    <div className="planner-bottom"><span className="small muted">{items.filter(i => i.status === 'confirmed').length} reviewed pieces · No purchases needed</span><button className="button primary" disabled={busy || saving !== null}><Sparkles size={17}/>{busy ? 'Finding your combinations…' : result ? 'Try a fresh set' : 'Find my outfits'}<ArrowRight size={16}/></button></div></form>
    {!capacity && <div className="soft-note">A complete look needs shoes and a dress, a top with bottoms, or an explicitly reviewed full set. Add and review pieces you already own to get started.</div>}
    {error && <p className="error" role="alert">{error}</p>}{busy && <div className="ai-wait" role="status"><Sparkles className="pulse"/><h3>Reimagining what’s already yours.</h3><p>Finding combinations from your reviewed pieces…</p></div>}
    {result && <><div className="result-heading"><h3 ref={resultsHeading} tabIndex={-1}>{result.suggestions.length ? `${result.suggestions.length} ${result.suggestions.length === 1 ? 'way' : 'ways'} to make it yours` : 'A little more closet clarity first'}</h3><span className="pill">FROM YOUR CLOSET</span></div>{result.inventoryNote && <p className="soft-note">{result.inventoryNote}</p>}<div className="suggestion-grid">{result.suggestions.map((outfit,i) => <article className="suggestion-card" key={i}><Collage ids={outfit.garmentIds} items={items}/><div className="outfit-copy"><p className="eyebrow">LOOK 0{i+1}</p><h3>{outfit.title}</h3><p className="muted">{outfit.explanation}</p><ul className="garment-names">{outfit.garmentIds.map(id => <li key={id}>{items.find(x => x.id === id)?.name}</li>)}</ul><button className={`button ${saved.includes(i) ? 'secondary' : 'primary'} full`} onClick={() => save(outfit,i)} disabled={saving !== null || saved.includes(i)}>{saved.includes(i) ? <Check size={16}/> : <Bookmark size={16}/>} {saved.includes(i) ? 'Saved to your outfits' : saving === i ? 'Saving…' : 'Save this outfit'}</button></div></article>)}</div></>}
  </Modal>;
}
export function OutfitDetail({ outfit, items, onClose, onChanged, onEdit }: { outfit: SavedOutfit; items: Garment[]; onClose(): void; onChanged(): void; onEdit?():void }) {
  const [date, setDate] = useState(localDate()); const [rating, setRating] = useState(outfit.outfit_feedback?.[0]?.rating || 0); const [comment, setComment] = useState(outfit.outfit_feedback?.[0]?.comment || '');
  const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [busy, setBusy] = useState(false); const [deleting, setDeleting] = useState(false);
  const available = !outfit.invalidated && outfit.outfit_items.every(x => items.some(i => i.id === x.item_id && i.status === 'confirmed'));
  async function wear(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try { await api('/wear-logs', { method: 'POST', body: JSON.stringify({ outfitId: outfit.id, wornOn: date }) }); setNotice('Wear recorded. A favorite, on repeat.'); onChanged(); }
    catch (err) { setError(message(err)); } finally { setBusy(false); }
  }
  async function feedback(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try { await api(`/outfits/${outfit.id}/feedback`, { method: 'POST', body: JSON.stringify({ rating, comment }) }); setNotice('Your feedback has been saved.'); onChanged(); }
    catch (err) { setError(message(err)); } finally { setBusy(false); }
  }
  async function remove() {
    setBusy(true); setError('');
    try { await api(`/outfits/${outfit.id}`, { method: 'DELETE' }); onChanged(); onClose(); }
    catch (err) { setError(message(err)); } finally { setBusy(false); }
  }
  return <Modal title={outfit.title} subtitle={`${outfit.occasion} · ${outfit.season}`} onClose={onClose} wide>{onEdit && <button className="button secondary edit-outfit-button" onClick={onEdit}>Edit outfit</button>}<div className="review-layout"><div><Collage ids={outfit.outfit_items.map(i => i.item_id)} items={items}/><p className="muted outfit-explanation">{outfit.explanation}</p><ul className="garment-names">{outfit.outfit_items.map(i => <li key={i.item_id}>{items.find(x => x.id === i.item_id)?.name || 'Garment removed'}</li>)}</ul></div><div className="outfit-detail-forms">
    {!available && <p className="soft-note">A garment in this saved outfit was removed. Your history is kept, but this look can’t be recorded as worn again.</p>}
    <form onSubmit={wear}><h3>Made it your look?</h3><p className="muted small">Only record a wear when you actually wore this outfit.</p><label>Date worn<input type="date" value={date} onChange={e => setDate(e.target.value)} max={localDate()} required disabled={!available}/></label><button className="button primary full" disabled={busy || !available}><Check size={16}/> I wore this outfit</button></form>
    <form onSubmit={feedback} className="feedback-form"><h3>How did it feel?</h3><fieldset className="rating-field"><legend className="small muted">Your rating</legend><div className="stars">{[1,2,3,4,5].map(n => <label key={n} aria-label={`${n} star${n === 1 ? '' : 's'}`}><input type="radio" name="rating" value={n} checked={rating === n} onChange={() => setRating(n)} required/><Star size={24} fill={rating >= n ? 'currentColor' : 'none'}/></label>)}</div></fieldset><label>A note for next time<textarea value={comment} onChange={e => setComment(e.target.value)} maxLength={500} placeholder="Loved the colors, would change the shoes…" rows={3}/></label><button className="button secondary full" disabled={busy || !rating}>Save feedback</button></form>
    {notice && <p className="success" role="status">{notice}</p>}{error && <p className="error" role="alert">{error}</p>}
    {deleting ? <div className="delete-confirm"><p>Delete this saved outfit, its feedback, and its wear history? Your garments stay in your closet.</p><div className="button-row"><button className="button danger small" onClick={remove} disabled={busy}>Delete outfit</button><button className="text-button" onClick={() => setDeleting(false)}>Keep it</button></div></div> : <button className="text-button destructive" onClick={() => setDeleting(true)}><Trash2 size={14}/> Delete saved outfit</button>}
  </div></div></Modal>;
}
