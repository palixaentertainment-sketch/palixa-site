'use client';

import { useState } from 'react';
import Link from 'next/link';
import { supabase, configured } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';

const CASE_ID = 'campus-gist-investigation-2026-11';

const EXHIBITS = [
  ['A', 'The ₦340,000 connection', 'Tomi needed ₦340,000. Her bursary balance raises questions about the same amount.'],
  ['B', 'Palm Court Suites', 'A keycard connects Tomi to a room rented monthly under a suspicious company name.'],
  ['C', 'The motor park journey', 'Dayo admits taking Tomi to the motor park, but his account leaves unanswered questions.'],
  ['D', 'The missing page', 'Tomi’s Evidence Law script was missing a page.'],
  ['E', 'Fourteen recordings', 'A micro SD card hidden inside the script contains 14 audio recordings.'],
];

export default function CampusGistInvestigationPage() {
  const { user, profile } = useAuth();
  const [theory, setTheory] = useState('');
  const [suspect, setSuspect] = useState('');
  const [clues, setClues] = useState('');
  const [recordings, setRecordings] = useState('');
  const [email, setEmail] = useState(user?.email || '');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError(''); setMessage('');
    if (!user) { setError('Please log in to submit your investigation.'); return; }
    if (theory.trim().length < 100) { setError('Your theory needs at least 100 characters. Explain your reasoning.'); return; }
    if (clues.trim().length < 30) { setError('Tell us which clues support your theory.'); return; }
    if (!email.trim()) { setError('Add an email address so Palixia can contact you if you win.'); return; }
    setBusy(true);
    const { error: saveError } = await supabase.from('palixia_friday_investigation_entries').insert({
      case_id: CASE_ID,
      user_id: user.id,
      display_name: profile?.name || user.email,
      username: profile?.username || '',
      contact_email: email.trim(),
      theory: theory.trim(),
      suspicious_person: suspect.trim(),
      supporting_clues: clues.trim(),
      recordings_theory: recordings.trim(),
    });
    setBusy(false);
    if (saveError) {
      setError(saveError.code === '23505' ? 'You have already submitted an investigation for this challenge.' : 'Your entry could not be submitted. Please try again. If the problem continues, contact Palixia.');
      return;
    }
    setSubmitted(true);
  }

  return <main className="page campus-case-page">
    <section className="campus-case-hero">
      <p className="mono">PALIXIA FRIDAY · SPECIAL INVESTIGATION</p>
      <span className="campus-case-stamp">CASE FILE 001</span>
      <h1 className="h1">The Campus Gist Investigation</h1>
      <p className="campus-case-lead">A student is missing. The stories don't match. And fourteen recordings may hold the answers.</p>
      <div className="campus-case-meta"><span>🔎 Read Chapters 1–8</span><span>🗓 Opens Friday, 27 November</span><span>⏳ Closes Sunday, 29 November · 8 p.m.</span></div>
      <Link className="btn" href="/discover?q=Campus%20Gist">Find Campus Gist on Palixia ↗</Link>
    </section>

    <section className="campus-case-intro stack">
      <p className="mono">YOUR ASSIGNMENT</p>
      <h2 className="h2">Become the investigator.</h2>
      <p>Read <b>Campus Gist</b> Chapters 1–8. Examine the evidence below, connect the details and submit a theory explaining what you believe happened to Tomi.</p>
      <p className="fine">You are not expected to know what happens in future chapters. We will judge the quality of your investigation using only the evidence available in Chapters 1–8.</p>
    </section>

    <section className="campus-case-evidence stack">
      <div><p className="mono">THE EVIDENCE BOARD</p><h2 className="h2">Five exhibits. One missing student.</h2></div>
      <div className="campus-exhibit-grid">{EXHIBITS.map(([letter, title, description]) => <article className="campus-exhibit" key={letter}><span>EXHIBIT {letter}</span><h3>{title}</h3><p>{description}</p></article>)}</div>
      <p className="fine">These are starting points, not the complete investigation. Look for additional details in the chapters.</p>
    </section>

    <section className="campus-case-mission stack">
      <p className="mono">YOUR MISSION</p><h2 className="h2">Answer four questions.</h2>
      <ol><li>What do you think really happened to Tomi?</li><li>Who is the most suspicious person, and why?</li><li>Which three or more story clues support your theory?</li><li>What do you think the fourteen recordings might reveal?</li></ol>
    </section>

    <section className="campus-case-rules stack">
      <p className="mono">BEFORE YOU SUBMIT</p><h2 className="h2">Investigation rules</h2>
      <ul><li>Read Chapters 1–8 of <i>Campus Gist</i> on Palixia.</li><li>Submit your own original theory, supported by at least three clues.</li><li>One entry per Palixia account.</li><li>Keep your main theory between 100 and 800 words.</li><li>Entries close Sunday, 29 November 2026, at 8 p.m. (Nigeria time).</li><li>Don't worry about guessing future plot twists. We judge your reasoning, not whether your prediction matches the unpublished story.</li></ul>
    </section>

    <section className="campus-case-scoring stack">
      <p className="mono">HOW WE'LL JUDGE</p><h2 className="h2">20 points available</h2>
      <div className="campus-score-grid"><div><b>5</b><span>Use of story clues</span></div><div><b>5</b><span>Connecting evidence</span></div><div><b>5</b><span>Reasoning</span></div><div><b>5</b><span>Originality</span></div></div>
      <p className="fine">The strongest investigation wins. It is not a first-come, first-served competition.</p>
    </section>

    <section className="campus-case-submit stack" id="submit-investigation">
      <p className="mono">SUBMIT YOUR CASE</p><h2 className="h2">What's your theory?</h2>
      {!user ? <div className="notice">Log in to submit your investigation. <Link className="linkbtn" href="/login?next=%2Ffridays%2Fcampus-gist-investigation">Log in</Link> or <Link className="linkbtn" href="/signup">create an account</Link>.</div> : submitted ? <div className="campus-submitted"><span>✓</span><h3>Investigation received.</h3><p>Your entry has been submitted to Palixia. Thank you for taking part. Good luck! 💜</p></div> : <form className="stack" onSubmit={submit}>
        <p className="fine">Submitting as <b>{profile?.name || user.email}</b> · @{profile?.username || 'Palixia reader'}</p>
        <label className="field"><span>Contact email</span><input className="in" type="email" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)} /></label>
        <label className="field"><span>1. Your investigation theory</span><textarea className="in" rows={7} maxLength={5000} required value={theory} onChange={e => setTheory(e.target.value)} placeholder="What do you believe happened to Tomi? Explain how you reached your conclusion." /><small className="fine">{theory.length}/5000 characters · Minimum 100 characters</small></label>
        <label className="field"><span>2. Who is your most suspicious character, and why?</span><textarea className="in" rows={3} maxLength={1500} value={suspect} onChange={e => setSuspect(e.target.value)} placeholder="Name the person and explain what makes them suspicious." /></label>
        <label className="field"><span>3. At least three clues supporting your theory</span><textarea className="in" rows={4} maxLength={2500} required value={clues} onChange={e => setClues(e.target.value)} placeholder="List the clues and explain how they connect." /></label>
        <label className="field"><span>4. What do you think the 14 recordings will reveal?</span><textarea className="in" rows={3} maxLength={1500} value={recordings} onChange={e => setRecordings(e.target.value)} placeholder="Your prediction..." /></label>
        {error && <p className="msg-err" role="alert">{error}</p>}
        <button className="btn" disabled={busy}>{busy ? 'Submitting investigation…' : 'Submit my investigation'}</button>
        <p className="fine">One submission per account. Your entry is visible to Palixia administrators for judging.</p>
      </form>}
    </section>
    <p className="campus-case-footer">PALIXIA FRIDAY · READ CLOSELY. THINK DEEPLY. FOLLOW THE EVIDENCE. 💜</p>
  </main>;
}
