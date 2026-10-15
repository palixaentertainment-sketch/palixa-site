'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase, configured } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';

function formatDate(value) {
  return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export default function PalixiaFridaysPage() {
  const { user } = useAuth();
  const [hunt, setHunt] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [solved, setSolved] = useState([]);
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
      setLoadError('Palixia Fridays is waiting for its database setup.');
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
      setLoadError('Palixia Fridays needs its database setup. Run supabase/palixia_fridays.sql in Supabase SQL Editor, then refresh this page.');
      setLoading(false);
      return;
    }
    const selected = hunts?.[0] || null;
    setHunt(selected);
    if (!selected) {
      setQuestions([]);
      setSolved([]);
      setLoading(false);
      return;
    }
    const { data: clueRows, error: clueError } = await supabase
      .from('palixia_friday_questions')
      .select('id,sort_order,prompt,hint,source_hint')
      .eq('hunt_id', selected.id)
      .order('sort_order', { ascending: true });
    if (clueError) {
      setLoadError('The hunt details could not be loaded. Please refresh and try again.');
      setLoading(false);
      return;
    }
    setQuestions(clueRows || []);
    if (user) {
      const { data: entry, error: entryError } = await supabase
        .from('palixia_friday_entries')
        .select('solved_question_ids,completed_at')
        .eq('hunt_id', selected.id)
        .eq('user_id', user.id)
        .maybeSingle();
      if (entryError) setNotice('Your progress could not be loaded. You can still try the current clue.');
      setSolved(entry?.solved_question_ids || []);
    } else {
      setSolved([]);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const current = useMemo(() => questions.find((q) => !solved.includes(q.id)) || null, [questions, solved]);
  const starts = hunt ? new Date(hunt.starts_at).getTime() : 0;
  const ends = hunt ? new Date(hunt.ends_at).getTime() : 0;
  const now = Date.now();
  const notStarted = hunt && now < starts;
  const closed = hunt && now > ends;
  const completed = questions.length > 0 && solved.length >= questions.length;

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
        setSolved((old) => old.includes(current.id) ? old : [...old, current.id]);
        setAnswer('');
        setHintOpen(false);
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
        <p className="fridays-intro">A story hunt for curious readers. Follow the clues across Palixia, read carefully, and solve each stage for a chance to win.</p>
        <div className="fridays-hero-tags"><span>🔎 Multi-stage mysteries</span><span>📚 Stories to discover</span><span>🎁 Real prizes</span></div>
      </section>

      {notice && <p className={'notice fridays-notice ' + noticeType} role="status">{notice}</p>}
      {loadError && <div className="notice"><b>We're preparing the next hunt.</b><p>{loadError}</p></div>}
      {loading && <div className="fridays-loading" aria-live="polite"><span className="fridays-loader" />Loading the hunt…</div>}

      {!loading && !loadError && !hunt && (
        <section className="fridays-empty">
          <div className="fridays-empty-icon" aria-hidden="true">✧</div>
          <p className="mono">NEXT MISSION IN PREPARATION</p>
          <h2 className="h2">The next mystery is being prepared.</h2>
          <p>Check back on Friday. In the meantime, explore Palixia and discover a story you haven't read yet.</p>
          <Link className="btn" href="/discover">Explore stories</Link>
        </section>
      )}

      {!loading && hunt && (
        <section className="fridays-hunt">
          <div className="fridays-hunt-top">
            <div><span className="fridays-live"><span />{notStarted ? 'UPCOMING HUNT' : closed ? 'HUNT CLOSED' : 'HUNT IS LIVE'}</span>
              <h2 className="h2">{hunt.title}</h2>
              <p>{hunt.description}</p>
            </div>
            <div className="fridays-prize"><span>PRIZE</span><strong>{hunt.prize_type === 'cash' ? '₦' : '₦'}{Number(hunt.prize_value).toLocaleString()}</strong><small>{hunt.prize_type === 'airtime' ? 'Airtime' : 'Cash'}</small></div>
          </div>
          <div className="fridays-dates"><span>Starts: {formatDate(hunt.starts_at)}</span><span>Ends: {formatDate(hunt.ends_at)}</span></div>

          {notStarted && <div className="fridays-callout">This hunt has been announced. Come back when it starts to unlock the first clue.</div>}
          {!notStarted && !closed && !user && <div className="fridays-callout">You need a Palixia account to submit answers and track your progress. <Link className="linkbtn" href="/login?next=%2Ffridays">Log in</Link> or <Link className="linkbtn" href="/signup">sign up</Link>.</div>}
          {completed && <div className="fridays-complete"><span aria-hidden="true">✦</span><div><b>Hunt completed!</b><p>You solved every clue. Your entry is recorded; check back for the winner announcement.</p></div></div>}
          {closed && !completed && <div className="fridays-callout">This hunt has ended. Thanks for taking part. Check back for the next challenge.</div>}

          <div className="fridays-progress-head"><b>Your progress</b><span>{Math.min(solved.length, questions.length)} of {questions.length} clues solved</span></div>
          <div className="fridays-progress" role="progressbar" aria-label="Hunt progress" aria-valuemin="0" aria-valuemax={questions.length || 1} aria-valuenow={solved.length}><span style={{ width: (questions.length ? Math.min(100, solved.length / questions.length * 100) : 0) + '%' }} /></div>

          {questions.length === 0 && <p className="muted">The hunt clues will appear here soon.</p>}
          {questions.map((question, index) => {
            const isSolved = solved.includes(question.id);
            const isCurrent = current?.id === question.id;
            const locked = !isSolved && !isCurrent;
            return (
              <article key={question.id} className={'fridays-clue' + (isSolved ? ' solved' : '') + (locked ? ' locked' : '')}>
                <div className="fridays-clue-number">{isSolved ? '✓' : locked ? '🔒' : String(index + 1).padStart(2, '0')}</div>
                <div className="fridays-clue-content">
                  <div className="fridays-clue-meta"><span>CLUE {String(index + 1).padStart(2, '0')}</span><span>{isSolved ? 'SOLVED' : locked ? 'LOCKED' : 'CURRENT CLUE'}</span></div>
                  <h3>{isSolved ? 'Clue solved' : locked ? 'Solve the previous clue first' : question.prompt}</h3>
                  {isSolved && <p className="muted">Nice work. Keep going.</p>}
                  {isCurrent && !notStarted && !closed && !completed && user && (
                    <>
                      {question.source_hint && <p className="fridays-source-hint">Where to search: {question.source_hint}</p>}
                      {question.hint && <div className="fridays-hint-wrap"><button type="button" className="fridays-hint-btn" onClick={() => setHintOpen((v) => !v)} aria-expanded={hintOpen}>{hintOpen ? 'Hide hint' : 'Need a hint?'}</button>{hintOpen && <p className="fridays-hint">{question.hint}</p>}</div>}
                      <form className="fridays-answer-form" onSubmit={submitAnswer}>
                        <label className="sr-only" htmlFor={'answer-' + question.id}>Your answer</label>
                        <input id={'answer-' + question.id} className="in" maxLength={500} autoComplete="off" placeholder="Enter your answer…" value={answer} onChange={(e) => setAnswer(e.target.value)} />
                        <button className="btn" disabled={sending || !answer.trim()}>{sending ? 'Checking…' : 'Unlock next clue'}</button>
                      </form>
                    </>
                  )}
                  {isCurrent && !user && <p className="muted">Log in to reveal your answer box.</p>}
                </div>
              </article>
            );
          })}
          <p className="fridays-rules">Free to enter. One entry per account. Answers are checked automatically. The winner-selection method and prize details will be stated in the hunt rules before entries open.</p>
        </section>
      )}

      <section className="fridays-past">
        <h2 className="h2">How to play</h2>
        <div className="fridays-how-grid"><article><span>01</span><b>Follow the clues</b><p>Explore author pages, book descriptions, and stories to find what each clue is asking for.</p></article><article><span>02</span><b>Read closely</b><p>Some answers require details from the story, not just a quick search.</p></article><article><span>03</span><b>Unlock the next stage</b><p>Correct answers reveal the next clue. Solve the hunt before the deadline.</p></article></div>
      </section>
    </main>
  );
}
