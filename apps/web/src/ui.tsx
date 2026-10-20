import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { X, LoaderCircle, Leaf, Shirt } from 'lucide-react';
import type { Garment } from '@wardrobe/shared';
export function Logo() { return <span className="logo"><span className="logo-mark"><Leaf size={21} strokeWidth={1.6}/></span><span>loopwear<span className="logo-dot">.</span></span></span>; }
export function Spinner({ text = 'Loading your wardrobe…' }: { text?: string }) { return <div className="loading" role="status"><LoaderCircle className="spin" size={22}/><span>{text}</span></div>; }
export function Modal({ title, subtitle, children, onClose, wide = false }: { title: string; subtitle?: string; children: ReactNode; onClose(): void; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  const trigger = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const dialog = ref.current!;
    trigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.showModal();
    return () => { dialog.close(); if (trigger.current?.isConnected) trigger.current.focus(); };
  }, []);
  return <dialog ref={ref} className={`modal ${wide ? 'wide' : ''}`} aria-labelledby={`${id}-title`} aria-describedby={subtitle ? `${id}-description` : undefined} onCancel={onClose} onClick={e => { if (e.target === e.currentTarget) { const rect = e.currentTarget.getBoundingClientRect(); if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) onClose(); } }}>
    <div className="modal-head"><div><p className="eyebrow">YOUR PERSONAL WARDROBE</p><h2 id={`${id}-title`}>{title}</h2>{subtitle && <p id={`${id}-description`} className="muted">{subtitle}</p>}</div><button className="icon-button" type="button" aria-label="Close dialog" onClick={onClose}><X size={21} aria-hidden="true"/></button></div>{children}
  </dialog>;
}
export function Empty({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) { return <div className="empty"><div className="empty-icon"><Shirt size={32} strokeWidth={1.2}/></div><h3>{title}</h3><p>{children}</p>{action}</div>; }
export function Photo({ src, name }: { src?: string; name: string }) {
  const [failedSrc, setFailedSrc] = useState<string>();
  return src && failedSrc !== src ? <img src={src} alt={name} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailedSrc(src)}/> : <div className="photo-missing"><Shirt aria-hidden="true"/><span>Photo unavailable. Use “Refresh wardrobe” to try again.</span></div>;
}
export function GarmentPhoto({item}:{item:Garment}) { return item.photo_path ? <Photo src={item.photoUrl} name={item.name}/> : <div className="category-placeholder"><Shirt size={32} aria-hidden="true"/><span>{item.category || 'Inventory item'}</span><small>No photo added</small></div>; }
