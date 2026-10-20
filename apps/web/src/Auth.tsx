import { useState, type FormEvent } from 'react';
import { ArrowRight, Check, LockKeyhole, Sparkles, Leaf } from 'lucide-react';
import { authConfigured, supabase, message } from './lib';
import { Logo } from './ui';
export function ClosetIllustration() {
  return <svg className="closet-art" viewBox="0 0 620 400" role="img" aria-label="Illustration of a thoughtfully arranged clothing rail">
    <ellipse cx="310" cy="366" rx="242" ry="12" fill="#d8d2c7" opacity=".5"/>
    <path d="M90 354V65a18 18 0 0 1 18-18h404a18 18 0 0 1 18 18v289M73 355h36m402 0h38" stroke="#665e50" strokeWidth="6" fill="none" strokeLinecap="round"/>
    <path d="M116 70h388" stroke="#665e50" strokeWidth="5"/>
    <g stroke="#746857" strokeWidth="2.5" fill="none"><path d="M178 100v-9c0-12 18-12 18-2 0 6-10 9-10 15l-60 32h120l-60-32M300 100v-9c0-12 18-12 18-2 0 6-10 9-10 15l-60 32h120l-60-32M422 100v-9c0-12 18-12 18-2 0 6-10 9-10 15l-60 32h120l-60-32"/></g>
    <path d="m148 119 29-9q11 13 23 0l29 9 33 61-26 17-16-31v134h-68V166l-16 31-26-17z" fill="#eae4d7" stroke="#b6ad9c" strokeWidth="1.8"/>
    <path d="m177 110 11 30 12-30m-12 30v159m-29-91h20v22h-20m39-22h15v22h-15" fill="none" stroke="#b6ad9c" strokeWidth="1.3"/><g fill="#a19785"><circle cx="188" cy="168" r="2"/><circle cx="188" cy="198" r="2"/><circle cx="188" cy="228" r="2"/><circle cx="188" cy="258" r="2"/></g>
    <path d="m272 121 25-10q11 16 25 0l25 10 27 49-23 15-12-20v129h-68V165l-12 20-23-15z" fill="#617064" stroke="#47574c" strokeWidth="1.8"/>
    <path d="M297 112q11 25 25 0M277 287h56m-62-123 4 90m64-90-4 90" stroke="#859084" strokeWidth="2" fill="none"/>
    <path d="m391 128 30-16h15l30 16 23 88-22 5-13-52 1 147h-66l2-147-13 52-22-5z" fill="#bca68a" stroke="#927e64" strokeWidth="1.8"/>
    <path d="m421 112-9 42 16-9 16 9-8-42m-8 33v171m-31-73h19v28h-19m43-28h9v28h-9" fill="none" stroke="#927e64" strokeWidth="1.5"/><g fill="#7c6955"><circle cx="432" cy="174" r="2"/><circle cx="432" cy="204" r="2"/><circle cx="432" cy="234" r="2"/><circle cx="432" cy="264" r="2"/></g>
    <path d="M112 334h392" stroke="#665e50" strokeWidth="4"/>
    <rect x="135" y="312" width="80" height="18" rx="5" fill="#8b9386"/><rect x="140" y="298" width="72" height="15" rx="5" fill="#c6b7a2"/>
    <path d="M359 329v-21h20l11 12 24 3q7 1 7 7zM430 329v-21h20l11 12 24 3q7 1 7 7z" fill="#534c42"/>
  </svg>;
}
export function Auth() {
  const [register, setRegister] = useState(false); const [busy, setBusy] = useState(false);
  const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setNotice('');
    if (!supabase) { setError('Connect Supabase using the setup steps below before signing in.'); return; }
    const data = new FormData(event.currentTarget); const email = String(data.get('email')); const password = String(data.get('password'));
    setBusy(true);
    try {
      const result = register ? await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } }) : await supabase.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
      if (register && !result.data.session) setNotice('Check your email to confirm your account, then come back and sign in.');
    } catch (err) { setError(message(err)); } finally { setBusy(false); }
  }
  return <div className="auth-page"><section className="auth-story"><Logo/><div className="story-content"><span className="pill"><Leaf size={13}/> LESS BUYING. MORE WEARING.</span><h1>Good style starts<br/>with what you <em>own.</em></h1><p>A little closet clarity. A fresh outfit idea.<br/>Make more of the wardrobe you already have.</p><ClosetIllustration/><div className="story-note"><span className="fine-line"/> YOUR STYLE. ON REPEAT.</div></div><footer>Wardrobe App by LoopWear <span>A more thoughtful way to get dressed.</span></footer></section>
    <main className="auth-form-side"><div className="auth-form-wrap"><div className="auth-badge"><Sparkles size={22}/></div><p className="eyebrow">A FRESH PERSPECTIVE ON YOUR CLOSET</p><h2>{register ? 'Make room for you.' : 'Welcome to your wardrobe.'}</h2><p className="muted">{register ? 'One private space for your clothes, outfits, and everyday style.' : 'Your favorite pieces. A world of possibilities.'}</p>
      <div className="auth-tabs" aria-label="Account action"><button className={!register ? 'active' : ''} aria-pressed={!register} onClick={() => { setRegister(false); setError(''); setNotice(''); }}>Sign in</button><button className={register ? 'active' : ''} aria-pressed={register} onClick={() => { setRegister(true); setError(''); setNotice(''); }}>Create account</button></div>
      <form onSubmit={submit}><label>Email address<input name="email" type="email" autoComplete="email" placeholder="you@example.com" required maxLength={254}/></label><label>Password<input name="password" type="password" autoComplete={register ? 'new-password' : 'current-password'} placeholder={register ? 'At least 8 characters' : 'Enter your password'} minLength={register ? 8 : 1} maxLength={128} required/></label>
      {error && <p className="error" role="alert">{error}</p>}{notice && <p className="success" role="status"><Check size={16}/>{notice}</p>}
      <button className="button primary full" disabled={busy || !authConfigured}>{busy ? 'Please wait…' : register ? 'Create your wardrobe' : 'Step inside'}<ArrowRight size={17}/></button></form>
      {!authConfigured && <aside className="setup-note"><strong>Let’s connect your private closet.</strong><p>Setup is required before accounts and clothing can be saved.</p><ol><li>Apply the SQL migration in Supabase.</li><li>Copy both <code>.env.example</code> files to <code>.env</code> and add your Supabase keys.</li><li>Restart with <code>npm.cmd run dev</code>.</li></ol><p>See <code>README.md</code> for the full PowerShell instructions.</p></aside>}
      <div className="privacy-note"><LockKeyhole size={15}/><span>Your wardrobe is personal. Your photos stay private.</span></div>
    </div><div className="auth-bottom">Wear what you love. Love what you own.</div></main></div>;
}
