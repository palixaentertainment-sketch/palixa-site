'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Guard from '@/components/Guard';
import { supabase, configured } from '@/lib/supabase';

function localDateTime(offsetHours) {
  const date = new Date(Date.now() + offsetHours * 3600000);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function FridaysAdmin() {
  const [hunts, setHunts] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [questions, setQuestions] = useState([]);
  const [entries, setEntries] = useState([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [draftQuestions, setDraftQuestions] = useState([{ prompt: '', hint: '', sourceHint: '', answer: '' }]);
  const [prizeType, setPrizeType] = useState('airtime');
  const [prizeValue, setPrizeValue] = useState('1000');
  const [startsAt, setStartsAt] = useState(localDateTime(24));
  const [endsAt, setEndsAt] = useState(localDateTime(72));
  const [prompt, setPrompt] = useState('');
  const [hint, setHint] = useState('');
  const [sourceHint, setSourceHint] = useState('');
  const [answer, setAnswer] = useState('');
  const [winnerId, setWinnerId] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadHunts = useCallback(async () => {
    if (!configured) return;
    const { data, error: queryError } = await supabase.from('palixia_friday_hunts')
      .select('id,title,description,prize_type,prize_value,starts_at,ends_at,status,winner_user_id,winner_note,prize_sent')
      .order('created_at', { ascending: false }).limit(50);
    if (queryError) { setError('Run supabase/palixia_fridays.sql in Supabase SQL Editor first. Details: ' + queryError.message); return; }
    setHunts(data || []);
    if (!selectedId && data?.[0]) setSelectedId(data[0].id);
  }, [configured, selectedId]);

  const loadDetails = useCallback(async (id) => {
    if (!id) { setQuestions([]); setEntries([]); return; }
    const [q, e] = await Promise.all([
      supabase.from('palixia_friday_questions').select('id,sort_order,prompt,hint,source_hint').eq('hunt_id', id).order('sort_order'),
      supabase.from('palixia_friday_entries').select('id,user_id,solved_question_ids,completed_at,created_at,profiles!palixia_friday_entries_user_id_fkey(name,username)').eq('hunt_id', id).order('completed_at', { ascending: true }),
    ]);
    if (q.error || e.error) { setError('Could not load this hunt details. ' + (q.error?.message || e.error?.message || '')); return; }
    setQuestions(q.data || []);
    setEntries(e.data || []);
    setWinnerId(hunts.find((h) => h.id === id)?.winner_user_id || '');
  }, [hunts]);

  useEffect(() => { loadHunts(); }, [loadHunts]);
  useEffect(() => { if (selectedId) loadDetails(selectedId); }, [selectedId, loadDetails]);

  async function createHunt(e) {
    e.preventDefault();
    setBusy(true); setError(''); setMessage('');
    if (new Date(endsAt) <= new Date(startsAt)) {
      setError('The end time must be later than the start time.'); setBusy(false); return;
    }
    const filledQuestions = draftQuestions.filter((q) => q.prompt.trim() || q.answer.trim() || q.hint.trim() || q.sourceHint.trim());
    const incompleteQuestion = filledQuestions.some((q) => !q.prompt.trim() || !q.answer.trim());
    if (incompleteQuestion) {
      setError('Each question you start must include both the question text and its correct answer. Remove unused question boxes or complete them.');
      setBusy(false); return;
    }
    const { data, error: insertError } = await supabase.from('palixia_friday_hunts').insert({
      title: title.trim(), description: description.trim(), prize_type: prizeType,
      prize_value: Number(prizeValue), starts_at: new Date(startsAt).toISOString(),
      ends_at: new Date(endsAt).toISOString(), status: 'draft',
    }).select('id').single();
    if (insertError) setError('Could not create hunt: ' + insertError.message);
    else {
      let questionSaveError = null;
      for (const [index, q] of filledQuestions.entries()) {
        const { data: question, error: questionError } = await supabase.from('palixia_friday_questions').insert({
          hunt_id: data.id, sort_order: index + 1,
          prompt: q.prompt.trim(), hint: q.hint.trim(), source_hint: q.sourceHint.trim(),
        }).select('id').single();
        if (questionError) { questionSaveError = questionError; break; }
        const { error: answerError } = await supabase.from('palixia_friday_answer_keys').insert({ question_id: question.id, answer: q.answer.trim() });
        if (answerError) {
          await supabase.from('palixia_friday_questions').delete().eq('id', question.id);
          questionSaveError = answerError; break;
        }
      }
      setTitle(''); setDescription('');
      setDraftQuestions([{ prompt: '', hint: '', sourceHint: '', answer: '' }]);
      setMessage(questionSaveError
        ? 'Draft created, but a question could not be saved. Select the draft below and finish adding its clues.'
        : (filledQuestions.length ? `Draft created with ${filledQuestions.length} question(s). Review it below before publishing.` : 'Draft created. Add questions below before publishing.'));
      if (questionSaveError) setError('Question save issue: ' + questionSaveError.message);
      await loadHunts();
      setSelectedId(data.id);
    }
    setBusy(false);
  }

  async function addQuestion(e) {
    e.preventDefault();
    if (!selectedId) { setError('Create or select a hunt first.'); return; }
    if (questions.length >= 5) { setError('A Palixia Fridays hunt can have up to five questions.'); return; }
    if (!prompt.trim() || !answer.trim()) { setError('Each clue needs a question and a correct answer.'); return; }
    setBusy(true); setError(''); setMessage('');
    const { data: question, error: questionError } = await supabase.from('palixia_friday_questions').insert({
      hunt_id: selectedId, sort_order: questions.length + 1,
      prompt: prompt.trim(), hint: hint.trim(), source_hint: sourceHint.trim(),
    }).select('id').single();
    if (questionError) { setError('Could not add clue: ' + questionError.message); setBusy(false); return; }
    const { error: answerError } = await supabase.from('palixia_friday_answer_keys').insert({ question_id: question.id, answer: answer.trim() });
    if (answerError) {
      await supabase.from('palixia_friday_questions').delete().eq('id', question.id);
      setError('Could not save the private answer key: ' + answerError.message);
    } else {
      setPrompt(''); setHint(''); setSourceHint(''); setAnswer('');
      setMessage('Clue added. The answer key is stored separately from the public clue.');
      await loadDetails(selectedId);
    }
    setBusy(false);
  }

  async function publish(status) {
    if (!selectedId) return;
    setBusy(true); setError(''); setMessage('');
    if (status === 'published' && questions.length < 1) {
      setError('Add at least one question before publishing.'); setBusy(false); return;
    }
    const { error: updateError } = await supabase.from('palixia_friday_hunts').update({ status, updated_at: new Date().toISOString() }).eq('id', selectedId);
    if (updateError) setError('Could not update hunt: ' + updateError.message);
    else { setMessage(status === 'published' ? 'Hunt published. The announcement is now visible on Palixia.' : status === 'closed' ? 'Hunt closed.' : 'Hunt cancelled.'); await loadHunts(); }
    setBusy(false);
  }

  async function saveWinner(e) {
    e.preventDefault();
    if (!selectedId) return;
    setBusy(true); setError(''); setMessage('');
    const chosen = entries.find((entry) => entry.user_id === winnerId);
    if (chosen && !chosen.completed_at) {
      setError('Choose a participant who completed every clue.'); setBusy(false); return;
    }
    const { error: updateError } = await supabase.from('palixia_friday_hunts').update({
      winner_user_id: winnerId || null,
      winner_note: chosen ? 'Winner selected by Palixia administrator.' : null,
      prize_sent: false,
      status: 'closed',
      updated_at: new Date().toISOString(),
    }).eq('id', selectedId);
    if (updateError) setError('Could not record the winner: ' + updateError.message);
    else { setMessage('Winner recorded and the hunt closed. Mark the prize as sent after you have delivered it.'); await loadHunts(); }
    setBusy(false);
  }

  async function markPrizeSent() {
    if (!selectedId) return;
    setBusy(true); setError(''); setMessage('');
    const { error: updateError } = await supabase.from('palixia_friday_hunts').update({ prize_sent: true, updated_at: new Date().toISOString() }).eq('id', selectedId);
    if (updateError) setError('Could not update prize status: ' + updateError.message);
    else { setMessage('Prize marked as sent.'); await loadHunts(); }
    setBusy(false);
  }

  const selected = hunts.find((h) => h.id === selectedId);
  const completedEntries = entries.filter((entry) => entry.completed_at);

  return (
    <main className="page fridays-admin">
      <div className="row between"><div><p className="mono">ADMIN TOOLS</p><h1 className="h1">Manage Palixia Fridays</h1><p className="muted">Create a hunt, write the clues, publish the announcement, and track the winner.</p></div><Link className="btn ghost" href="/fridays">View public page ↗</Link></div>
      {message && <p className="notice" role="status">{message}</p>}
      {error && <p className="notice" role="alert">{error}</p>}

      <section className="fridays-admin-panel">
        <h2 className="h2">Create a new hunt</h2>
        <p className="muted">You can add up to five questions and their private correct answers right here. You can also create a draft first and finish it in Edit a hunt below.</p>
        <form className="stack" onSubmit={createHunt}>
          <label className="field"><span>Hunt title</span><input className="in" required maxLength={100} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. The Missing Page" /></label>
          <label className="field"><span>Instructions and story</span><textarea className="in" rows={3} required maxLength={1500} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Set the scene and explain how to take part." /></label>
          <div className="fridays-create-questions">
            <div className="row between"><div><h3>Hunt questions</h3><p className="muted">Add up to 5 questions. Each question needs its correct answer.</p></div><span className="fine">{draftQuestions.filter((q) => q.prompt.trim()).length}/5</span></div>
            {draftQuestions.map((q, index) => <fieldset className="fridays-draft-question" key={index}>
              <legend>Question {index + 1}</legend>
              <label className="field"><span>Question or clue</span><textarea className="in" rows={2} maxLength={1000} value={q.prompt} onChange={(e) => setDraftQuestions((items) => items.map((item, i) => i === index ? { ...item, prompt: e.target.value } : item))} placeholder="What should readers find?" /></label>
              <label className="field"><span>Correct answer (private)</span><input className="in" maxLength={500} value={q.answer} onChange={(e) => setDraftQuestions((items) => items.map((item, i) => i === index ? { ...item, answer: e.target.value } : item))} placeholder="Only the answer checker can access this." /></label>
              <label className="field"><span>Where should they search? (optional)</span><input className="in" maxLength={200} value={q.sourceHint} onChange={(e) => setDraftQuestions((items) => items.map((item, i) => i === index ? { ...item, sourceHint: e.target.value } : item))} placeholder="e.g. a book description" /></label>
              <label className="field"><span>Optional hint</span><input className="in" maxLength={300} value={q.hint} onChange={(e) => setDraftQuestions((items) => items.map((item, i) => i === index ? { ...item, hint: e.target.value } : item))} placeholder="A nudge if readers get stuck." /></label>
              {draftQuestions.length > 1 && <button type="button" className="btn ghost" onClick={() => setDraftQuestions((items) => items.filter((_, i) => i !== index))}>Remove question</button>}
            </fieldset>)}
            {draftQuestions.length < 5 && <button type="button" className="btn ghost" onClick={() => setDraftQuestions((items) => [...items, { prompt: '', hint: '', sourceHint: '', answer: '' }])}>+ Add question</button>}
          </div>
          <div className="fridays-admin-grid">
            <label className="field"><span>Prize type</span><select className="in" value={prizeType} onChange={(e) => setPrizeType(e.target.value)}><option value="airtime">Airtime</option><option value="cash">Cash</option></select></label>
            <label className="field"><span>Prize value (₦)</span><input className="in" type="number" min="0" max="1000000" required value={prizeValue} onChange={(e) => setPrizeValue(e.target.value)} /></label>
            <label className="field"><span>Start date and time</span><input className="in" type="datetime-local" required value={startsAt} onChange={(e) => setStartsAt(e.target.value)} /></label>
            <label className="field"><span>End date and time</span><input className="in" type="datetime-local" required value={endsAt} onChange={(e) => setEndsAt(e.target.value)} /></label>
          </div>
          <button className="btn" disabled={busy}>{busy ? 'Creating…' : 'Create draft hunt'}</button>
        </form>
      </section>

      <section className="fridays-admin-panel">
        <h2 className="h2">Edit a hunt</h2>
        <label className="field"><span>Select hunt</span><select className="in" value={selectedId} onChange={(e) => setSelectedId(e.target.value)}><option value="">Choose a hunt…</option>{hunts.map((h) => <option key={h.id} value={h.id}>{h.title} · {h.status}</option>)}</select></label>
        {!selected && <p className="muted">Create a draft above to start adding clues.</p>}
        {selected && <>
          <div className="fridays-admin-selected"><div><span className="fridays-live"><span />{selected.status.toUpperCase()}</span><h3>{selected.title}</h3><p>Prize: ₦{Number(selected.prize_value).toLocaleString()} {selected.prize_type}</p><p className="fine">{new Date(selected.starts_at).toLocaleString()} – {new Date(selected.ends_at).toLocaleString()}</p></div><div className="row"><button type="button" className="btn" disabled={busy || selected.status === 'published' || selected.status === 'closed' || selected.status === 'cancelled'} onClick={() => publish('published')}>Publish & announce</button>{selected.status === 'published' && <button type="button" className="btn ghost" disabled={busy} onClick={() => publish('closed')}>Close hunt</button>}{selected.status === 'draft' && <button type="button" className="btn danger" disabled={busy} onClick={() => publish('cancelled')}>Cancel draft</button>}</div></div>
          <div className="fridays-admin-clues"><h3>Questions ({questions.length}/5)</h3>{questions.map((q) => <article key={q.id}><b>Question {q.sort_order}</b><p>{q.prompt}</p>{q.source_hint && <small>Search location: {q.source_hint}</small>}</article>)}</div>
          {selected.status === 'draft' && questions.length < 5 && <form className="stack fridays-add-clue" onSubmit={addQuestion}>
            <h3>Add another question</h3><p className="muted">You can add {Math.max(0, 5 - questions.length)} more question(s) to this draft.</p>
            <label className="field"><span>Question or clue</span><textarea className="in" rows={3} required maxLength={1000} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Write the clue participants must solve." /></label>
            <label className="field"><span>Where should they search? (optional)</span><input className="in" maxLength={200} value={sourceHint} onChange={(e) => setSourceHint(e.target.value)} placeholder="e.g. a fantasy story's opening chapters" /></label>
            <label className="field"><span>Optional hint</span><input className="in" maxLength={300} value={hint} onChange={(e) => setHint(e.target.value)} placeholder="A nudge if they get stuck." /></label>
            <label className="field"><span>Correct answer (private)</span><input className="in" required maxLength={500} value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Only the answer checker can access this." /></label>
            <button className="btn" disabled={busy}>{busy ? 'Saving…' : 'Add clue'}</button>
          </form>}
          {selected.status !== 'draft' && <p className="fine">Published clues are locked to protect active entries. Create a new draft for future changes.</p>}
          <div className="fridays-admin-entries"><h3>Participants ({entries.length})</h3>{entries.length === 0 && <p className="muted">No entries yet.</p>}{entries.map((entry) => <div key={entry.id} className="fridays-entry-row"><span><b>{entry.profiles?.name || 'Palixia reader'}</b><small>@{entry.profiles?.username || 'reader'}</small></span><span>{entry.completed_at ? 'Completed' : entry.solved_question_ids.length + '/' + questions.length + ' clues'}</span></div>)}</div>
          {selected.status === 'closed' && <form className="stack fridays-winner-form" onSubmit={saveWinner}><h3>Record winner</h3><label className="field"><span>Completed participants</span><select className="in" value={winnerId} onChange={(e) => setWinnerId(e.target.value)}><option value="">Choose a winner…</option>{completedEntries.map((entry) => <option key={entry.user_id} value={entry.user_id}>{entry.profiles?.name || entry.profiles?.username || entry.user_id}</option>)}</select></label><button className="btn" disabled={busy || !winnerId}>Save winner</button>{selected.winner_user_id && <p className="fine">Winner has been recorded. {selected.prize_sent ? 'Prize marked as sent.' : 'Prize has not yet been marked as sent.'}</p>}{selected.winner_user_id && !selected.prize_sent && <button type="button" className="btn ghost" disabled={busy} onClick={markPrizeSent}>Mark prize as sent</button>}</form>}
        </>}
      </section>
      <p className="fine">Keep the prize within your budget. Publish clear entry, deadline, and winner-selection rules before opening a competition.</p>
    </main>
  );
}

export default function PalixiaFridaysAdminPage() {
  return <Guard roles={['admin']}><FridaysAdmin /></Guard>;
}
