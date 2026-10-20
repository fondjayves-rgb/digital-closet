import { useEffect, useState, type FormEvent } from 'react';
import { Sparkles, Check, Trash2, Info, RefreshCw, Heart } from 'lucide-react';
import { categories, tagsSchema, inventorySchema, reviewSchema, type Garment, type Tags, type TagJob, type Review } from '@wardrobe/shared';
import { api, message } from './lib';
import { Modal, GarmentPhoto, Spinner } from './ui';
import { MetadataFields, inventoryFrom } from './InventoryFields';
type DraftReview = Omit<Review, 'category'> & { category: Review['category'] | '' };
const blank: DraftReview = { name: '', category: '', color: '', pattern: 'unknown', attributes: [] };
export function ReviewDialog({ item, onClose, onSaved, onDeleted, updated=true, onFavoriteChanged }: { item: Garment; onClose(): void; onSaved(): void; onDeleted(): void; updated?:boolean; onFavoriteChanged?():void }) {
  const [value, setValue] = useState<DraftReview>({ ...blank, ...item, category: item.category || '', color: item.color || '', attributes: item.attributes || [] });
  const [job, setJob] = useState<TagJob | null>(null); const [dirty, setDirty] = useState(false);
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [checking, setChecking] = useState(true);
  const [suggestion, setSuggestion] = useState<Tags | null>(null); const [confirmDelete, setConfirmDelete] = useState(false);
  const [loadError, setLoadError] = useState(''); const [revision, setRevision] = useState(0);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<'name' | 'category' | 'color', string>>>({});
  const pending = item.status === 'pending';
  const [metadata,setMetadata] = useState(()=>inventoryFrom({...item,category:item.category || 'tops'}));
  const [unknownColor,setUnknownColor] = useState(!item.color && !pending);
  const [favorite,setFavorite] = useState(Boolean(item.is_favorite));
  const [favoriteBusy,setFavoriteBusy] = useState(false);
  async function toggleFavorite() {
    setFavoriteBusy(true);setError('');
    try { await api(`/items/${item.id}/favorite`,{method:'PATCH',body:JSON.stringify({is_favorite:!favorite})});setFavorite(v=>!v);onFavoriteChanged?.(); }
    catch(err){setError(message(err));}finally{setFavoriteBusy(false);}
  }
  useEffect(() => {
    if (!pending) { setChecking(false); return; }
    let active = true;
    let timer: number | undefined;
    setChecking(true);
    async function load() {
      try {
        const data = await api<{ job: TagJob | null; suggestion: Tags | null }>(`/items/${item.id}`);
        if (!active) return;
        setJob(data.job); setSuggestion(data.suggestion); setLoadError('');
        if (data.job && ['queued', 'processing', 'retry'].includes(data.job.status)) timer = window.setTimeout(load, 3500);
      }
      catch (err) { if (active) setLoadError(message(err)); }
      finally { if (active) setChecking(false); }
    }
    void load();
    return () => { active = false; clearTimeout(timer); };
  }, [item.id, pending, revision]);
  useEffect(() => { if (suggestion && !dirty) setValue(v => ({ ...v, ...suggestion, category: suggestion.category || v.category, color: suggestion.color || v.color })); }, [suggestion, dirty]);
  function change<K extends keyof DraftReview>(key: K, next: DraftReview[K]) { setDirty(true); setValue(v => ({ ...v, [key]: next })); setFieldErrors(v => ({ ...v, [key]: undefined })); }
  async function analyze() {
    setError(''); setBusy(true);
    try { setJob(await api<TagJob>(`/items/${item.id}/analyze`, { method: 'POST' })); setRevision(n => n + 1); }
    catch (err) { setError(message(err)); } finally { setBusy(false); }
  }
  async function save(event: FormEvent) {
    event.preventDefault(); setError('');
    const errors = {
      ...(!value.name.trim() ? { name: 'Enter a name for this garment.' } : {}),
      ...(!value.category ? { category: 'Choose the garment category.' } : {}),
      ...(!unknownColor && !value.color.trim() ? { color: 'Enter the main color you can see, or mark it unspecified.' } : {}),
    };
    setFieldErrors(errors);
    if (Object.keys(errors).length) {
      setError('Check the highlighted garment details.');
      const field = Object.keys(errors)[0];
      (event.currentTarget as HTMLFormElement).querySelector<HTMLElement>(`[name="${field}"]`)?.focus();
      return;
    }
    const result = inventorySchema.safeParse({ ...metadata, name: value.name, category: value.category, color: unknownColor ? null : value.color, pattern: value.pattern, attributes: value.attributes, set_coverage: ['sets','suits'].includes(value.category) ? metadata.set_coverage : 'unspecified' });
    if (!result.success) { setError('Check the garment details and choose only the listed visible attributes.'); return; }
    setBusy(true);
    try { const body=updated ? result.data : reviewSchema.parse({name:value.name,category:value.category,color:value.color,pattern:value.pattern,attributes:value.attributes}); await api(`/items/${item.id}${pending ? '/confirm' : ''}`, { method: 'PATCH', body: JSON.stringify(body) }); onSaved(); }
    catch (err) { setError(message(err)); } finally { setBusy(false); }
  }
  async function remove() {
    setBusy(true); setError('');
    try { await api(`/items/${item.id}`, { method: 'DELETE' }); onDeleted(); }
    catch (err) { setError(message(err)); } finally { setBusy(false); }
  }
  const activeJob = job && ['queued','processing','retry'].includes(job.status);
  return <Modal title={pending ? 'A little review, then it’s yours.' : 'The details make the piece.'} subtitle={pending ? 'Check each detail before adding this garment to outfit planning.' : 'Keep your closet as considered as your style.'} onClose={onClose} wide>
    {updated&&<button className="button secondary edit-outfit-button" type="button" aria-pressed={favorite} onClick={()=>void toggleFavorite()} disabled={favoriteBusy}><Heart size={16} fill={favorite?'currentColor':'none'}/>{favorite?'Unfavorite item':'Favorite item'}</button>}
    <div className="review-layout"><div className="review-photo"><GarmentPhoto item={item}/><span className="pill"><Check size={13}/> {item.photo_path?'PRIVATE PHOTO':'REVIEWED INVENTORY'}</span></div><form onSubmit={save} className="review-form" aria-busy={busy}>
      {pending && item.photo_path && <div className="analysis-state">{checking ? <Spinner text="Checking analysis…"/> : activeJob ? <><Spinner text={job.status === 'processing' ? 'Looking at your garment…' : job.status === 'retry' ? 'Analysis will retry shortly…' : 'In the analysis queue…'}/><p>Attempt {job.attempts} of 3. You can enter and approve the details manually while analysis runs.</p></> : suggestion ? <><span className="text-green"><Sparkles size={16}/> AI tags are ready for your review</span><p>Only visible details are proposed. Correct anything that doesn’t look right.</p>{dirty && <button type="button" className="text-button" onClick={() => { setValue(v => ({ ...v, ...suggestion, category: suggestion.category || v.category, color: suggestion.color || v.color })); }}>Apply AI tags again</button>}</> : <><span className="text-green"><Info size={16}/> {job?.status === 'failed' ? 'Analysis needs another try' : 'Your photo is ready'}</span><p>{job?.last_error || 'Ask AI for a first pass, or enter the details yourself.'}</p><button type="button" className="button secondary small" onClick={analyze} disabled={busy}><Sparkles size={15}/> {job?.status === 'failed' ? 'Retry analysis' : 'Suggest tags with AI'}</button></>}</div>}
      {loadError && <div className="error" role="alert"><p>{loadError}</p><button type="button" className="text-button" onClick={() => setRevision(n => n + 1)} disabled={checking}><RefreshCw size={14}/> Retry status check</button></div>}
      <div className="field"><label htmlFor="review-name">Garment name</label><input id="review-name" name="name" value={value.name} onChange={e => change('name', e.target.value)} aria-invalid={Boolean(fieldErrors.name)} aria-describedby={fieldErrors.name ? 'review-name-error' : undefined} placeholder="e.g. Favorite ivory shirt" maxLength={100} required/>{fieldErrors.name && <span id="review-name-error" className="field-error">{fieldErrors.name}</span>}</div>
      <div className="form-row"><div className="field"><label htmlFor="review-category">Category</label><select id="review-category" name="category" value={value.category} onChange={e => change('category', e.target.value as DraftReview['category'])} aria-invalid={Boolean(fieldErrors.category)} aria-describedby={fieldErrors.category ? 'review-category-error' : undefined} required><option value="" disabled>Choose a category</option>{categories.filter((_c,index)=>updated||index<6).map(c => <option key={c} value={c}>{c[0].toUpperCase()+c.slice(1)}</option>)}</select>{fieldErrors.category && <span id="review-category-error" className="field-error">{fieldErrors.category}</span>}</div><div className="field"><label htmlFor="review-color">Main color</label><input id="review-color" name="color" value={value.color} onChange={e => change('color', e.target.value)} aria-invalid={Boolean(fieldErrors.color)} aria-describedby={fieldErrors.color ? 'review-color-error' : undefined} placeholder="e.g. Ivory" maxLength={60} required={!unknownColor} disabled={unknownColor}/>{fieldErrors.color && <span id="review-color-error" className="field-error">{fieldErrors.color}</span>}</div></div>
      <label className="check-label"><input type="checkbox" disabled={!updated} checked={unknownColor} onChange={e => { setUnknownColor(e.target.checked); setDirty(true); }}/>Color is unspecified</label>
      <div className="field"><label htmlFor="review-pattern">Pattern</label><select id="review-pattern" value={value.pattern} onChange={e => change('pattern', e.target.value as Review['pattern'])}>{tagsSchema.shape.pattern.options.map(p => <option key={p} value={p}>{p[0].toUpperCase()+p.slice(1)}</option>)}</select></div>
      <fieldset className="attribute-field"><legend>Visible details <span className="muted">(optional)</span></legend><div className="tag-options">{tagsSchema.shape.attributes.element.options.map(a => <label className={`tag-option ${value.attributes.includes(a) ? 'selected' : ''}`} key={a}><input type="checkbox" checked={value.attributes.includes(a)} onChange={e => change('attributes', e.target.checked ? [...value.attributes,a] : value.attributes.filter(x => x !== a))}/>{a}</label>)}</div></fieldset>
      {updated && <MetadataFields value={{...metadata,category:value.category || "tops"}} onChange={next => { setMetadata(next); setDirty(true); }}/>}
      <p className="small muted">Size, material, and fit aren’t inferred from your photo.</p>{error && <p className="error" role="alert">{error}</p>}
      <button className="button primary full" disabled={busy}><Check size={17}/>{busy ? 'Saving…' : pending ? 'Confirm & add to my closet' : 'Save changes'}</button>
      {confirmDelete ? <div className="delete-confirm"><p>Delete this garment and its photo? Saved outfits using it will be marked unavailable; wear history stays.</p><div className="button-row"><button className="button danger small" type="button" onClick={remove} disabled={busy}>Delete permanently</button><button className="text-button" type="button" onClick={() => setConfirmDelete(false)}>Keep garment</button></div></div> : <button className="text-button destructive" type="button" onClick={() => setConfirmDelete(true)}><Trash2 size={14}/> Delete garment</button>}
    </form></div>
  </Modal>;
}
