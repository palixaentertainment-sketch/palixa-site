'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase, configured } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';

function formatDate(value) {
  return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export default function PalixiaFridaysPage() {
  const { user } = useAuth();
  const [hunt, setHunt] = useState(null);
  const [clueData, setClueData] = useState(null);
  const [answer, setAnswer] = useState('');
  const [hintOpen, setHintOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState('');
  const [noticeType, setNoticeType] = useState('info');
  const [loadError, setLoadError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    if (!configured) {
      setLoading(false);
      return;
    }
    const now = new Date().toISOString();
    const { data: hunts, error: huntError } = await supabase
      .from('palixia_friday_hunts')
      .select('id,title,description,prize_type,prize_value,starts_at,ends_at,status,winner_user_id,winner_note,prize_sent')
      .eq('status', 'published')
      .gte('ends_at', now)
      .order('starts_at', { ascending: true })
      .limit(1);
    if (huntError) {
      // Keep the public page friendly while the first hunt is being configured.
      setHunt(null);
      setClueData(null);
      setLoading(false);
      return;
    }
    const selected = hunts?.[0] || null;
    setHunt(selected);
    setClueData(null);
    if (!selected) {
      setLoading(false);
      return;
    }
    const { data: clueResult, error: clueError } = await supabase.rpc('get_palixia_friday_current_clue', { p_hunt_id: selected.id });
    if (clueError) {
      setLoadError('We couldn’t load this hunt just now. Please check back shortly.');
      setLoading(false);
      return;
    }
    setClueData(clueResult || null);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const starts = hunt ? new Date(hunt.starts_at).getTime() : 0;
  const ends = hunt ? new Date(hunt.ends_at).getTime() : 0;
  const now = Date.now();
  const notStarted = hunt && now < starts;
  const closed = hunt && now > ends;
  const current = clueData?.current || null;
  const total = Number(clueData?.total || 0);
  const solved = Number(clueData?.solved || 0);
  const completed = Boolean(clueData?.completed);

  async function submitAnswer(e) {
    e.preventDefault();
    if (!user) {
      setNotice('Log in to take part in Palixia Fridays.');
      setNoticeType('error');
      return;
    }
    if (!current || !answer.trim() || sending) return;
    setSending(true);
    setNotice('');
    const { data, error: submitError } = await supabase.rpc('submit_palixia_friday_answer', {
      p_hunt_id: hunt.id,
      p_question_id: current.id,
      p_answer: answer.trim(),
    });
    if (submitError) {
      setNotice(submitError.message === 'login_required' ? 'Log in to take part.' : 'Your answer could not be checked. Please try again.');
      setNoticeType('error');
    } else {
      setNotice(data?.message || 'Answer checked.');
      setNoticeType(data?.correct ? 'success' : 'error');
      if (data?.correct) {
        setAnswer('');
        setHintOpen(false);
        const { data: nextClue, error: nextError } = await supabase.rpc('get_palixia_friday_current_clue', { p_hunt_id: hunt.id });
        if (!nextError) setClueData(nextClue || null);
      }
    }
    setSending(false);
  }

  return (
    <main className="page fridays-page">
      <section className="fridays-hero">
        <div className="fridays-spark" aria-hidden="true">✦</div>
        <p className="mono">EXPLORE · READ · SOLVE</p>
        <h1 className="h1">Palixia Fridays</h1>
        <p className="fridays-intro">A little story hunt for curious readers. Follow the clues across Palixia, read carefully, and see how far you get.</p>
        <div className="fridays-hero-tags"><span>🔎 Multi-stage mysteries</span><span>📚 Stories to discover</span><span>🧩 Test your detective skills</span></div>
      </section>

      {notice && <p className={'notice fridays-notice ' + noticeType} role="status">{notice}</p>}
      {loadError && <div className="notice"><b>We're preparing the next hunt.</b><p>{loadError}</p></div>}
      {loading && <div className="fridays-loading" aria-live="polite"><span className="fridays-loader" />Loading the hunt…</div>}

      {!loading && !loadError && !hunt && (
        <section className="fridays-empty">
          <div className="fridays-empty-icon" aria-hidden="true">✧</div>
          <p className="mono">COMING SOON</p>
          <h2 className="h2">Your next story hunt is almost here.</h2>
          <p>Palixia Fridays starts on Friday, October 23. Get ready to explore stories, follow clues, and test your detective skills.</p>
          <p className="fridays-coming-date">FRIDAY · OCTOBER 23, 2026</p>
          <Link className="btn" href="/discover">Explore stories while you wait</Link>
        </section>
      )}

      {!loading && hunt && (
        <section className="fridays-hunt">
          <div className="fridays-hunt-top">
            <div><span className="fridays-live"><span />{notStarted ? 'UPCOMING HUNT' : closed ? 'HUNT CLOSED' : 'HUNT IS LIVE'}</span>
              <h2 className="h2">{hunt.title}</h2>
              <div className="fridays-hunt-description" style={{ whiteSpace: 'pre-line' }}>{hunt.description}</div>
            </div>
          </div>
          <div className="fridays-dates"><span>Starts: {formatDate(hunt.starts_at)}</span><span>Ends: {formatDate(hunt.ends_at)}</span></div>

          {notStarted && <div className="fridays-callout">This hunt has been announced. Come back when it starts to unlock the first clue.</div>}
          {!notStarted && !closed && !user && <div className="fridays-callout">You need a Palixia account to submit answers and track your progress. <Link className="linkbtn" href="/login?next=%2Ffridays">Log in</Link> or <Link className="linkbtn" href="/signup">sign up</Link>.</div>}
          {completed && <div className="fridays-complete"><span aria-hidden="true">✦</span><div><b>Hunt completed!</b><p>You solved every clue. Your progress has been recorded. Thanks for taking part!</p></div></div>}
          {closed && !completed && <div className="fridays-callout">This hunt has ended. Thanks for taking part. Check back for the next challenge.</div>}

          <div className="fridays-progress-head"><b>Your progress</b><span>{Math.min(solved, total)} of {total} clues solved</span></div>
          <div className="fridays-progress" role="progressbar" aria-label="Hunt progress" aria-valuemin="0" aria-valuemax={total || 1} aria-valuenow={solved}><span style={{ width: (total ? Math.min(100, solved / total * 100) : 0) + '%' }} /></div>
          {total > 0 && <div className="fridays-stage-dots" aria-label={'Clue ' + Math.min(solved + 1, total) + ' of ' + total}>{Array.from({ length: total }, (_, index) => <span key={index} className={index < solved ? 'done' : index === solved && !completed ? 'current' : ''}>{index < solved ? '✓' : String(index + 1).padStart(2, '0')}</span>)}</div>}

          {!notStarted && !closed && !completed && current && (
            <article className="fridays-clue">
              <div className="fridays-clue-number">{String(current.sort_order).padStart(2, '0')}</div>
              <div className="fridays-clue-content">
                <div className="fridays-clue-meta"><span>CLUE {String(current.sort_order).padStart(2, '0')}</span><span>CURRENT STAGE</span></div>
                <h3>{current.prompt}</h3>
                {current.source_hint && <p className="fridays-source-hint">Where to search: {current.source_hint}</p>}
                {current.hint && <div className="fridays-hint-wrap"><button type="button" className="fridays-hint-btn" onClick={() => setHintOpen((v) => !v)} aria-expanded={hintOpen}>{hintOpen ? 'Hide hint' : 'Need a hint?'}</button>{hintOpen && <p className="fridays-hint">{current.hint}</p>}</div>}
                {user && <form className="fridays-answer-form" onSubmit={submitAnswer}>
                  <label className="sr-only" htmlFor={'answer-' + current.id}>Your answer</label>
                  <input id={'answer-' + current.id} className="in" maxLength={500} autoComplete="off" placeholder="Enter your answer…" value={answer} onChange={(e) => setAnswer(e.target.value)} />
                  <button className="btn" disabled={sending || !answer.trim()}>{sending ? 'Checking…' : 'Unlock next clue'}</button>
                </form>}
              </div>
            </article>
          )}
          {total === 0 && <p className="muted">The hunt clues will appear here soon.</p>}
          <p className="fridays-rules">Free to enter. One entry per account. Just follow the clues, explore Palixia, and have fun.</p>
        </section>
      )}

      <section className="fridays-past">
        <h2 className="h2">How to play</h2>
        <div className="fridays-how-grid"><article><span>01</span><b>Follow the clues</b><p>Explore author pages, book descriptions, and stories to find what each clue is asking for.</p></article><article><span>02</span><b>Read closely</b><p>Some answers require details from the story, not just a quick search.</p></article><article><span>03</span><b>Unlock the next stage</b><p>Correct answers reveal the next clue. Solve the hunt before the deadline.</p></article></div>
      </section>
    </main>
  );
}
