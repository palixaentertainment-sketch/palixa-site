'use client';
import { useCallback, useEffect, useState } from 'react';
import { supabase, configured } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';

export default function CommunityBookPolls() {
  const { user } = useAuth();
  const [polls, setPolls] = useState([]);
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [voting, setVoting] = useState({});
  const [deleting, setDeleting] = useState({});
  const [message, setMessage] = useState('');

  const loadPolls = useCallback(async () => {
    if (!configured) { setLoading(false); return; }
    const { data, error } = await supabase.from('community_polls')
      .select('id,creator_id,question,created_at,profiles!community_polls_creator_id_fkey(name,username),community_poll_options(id,option_text,position),community_poll_votes(user_id,option_id)')
      .order('created_at', { ascending: false }).limit(20);
    if (error) {
      console.error('Book Polls could not load:', error);
      setMessage('Book Polls need their database setup before they can be used.');
    } else {
      setPolls((data || []).map(p => ({ ...p, community_poll_options: (p.community_poll_options || []).sort((a,b) => a.position-b.position) })));
    }
    setLoading(false);
  }, []);
  useEffect(() => { loadPolls(); }, [loadPolls]);

  async function createPoll(e) {
    e.preventDefault();
    if (!user) { setMessage('Log in to create a poll.'); return; }
    const q = question.trim();
    const clean = options.map(x => x.trim()).filter(Boolean);
    if (q.length < 5) { setMessage('Write a question with at least 5 characters.'); return; }
    if (clean.length < 2) { setMessage('Add at least two answer options.'); return; }
    if (new Set(clean.map(x => x.toLowerCase())).size !== clean.length) { setMessage('Each answer option must be different.'); return; }
    setCreating(true); setMessage('');
    const { data: poll, error } = await supabase.from('community_polls').insert({ creator_id: user.id, question: q }).select('id').single();
    if (error || !poll) {
      console.error('Could not create poll:', error); setMessage('Could not create the poll. Please try again.'); setCreating(false); return;
    }
    const { error: optionError } = await supabase.from('community_poll_options').insert(clean.map((option_text, position) => ({ poll_id: poll.id, option_text, position })));
    if (optionError) {
      console.error('Could not save poll options:', optionError);
      await supabase.from('community_polls').delete().eq('id', poll.id);
      setMessage('The poll could not be completed. Please try again.'); setCreating(false); return;
    }
    setQuestion(''); setOptions(['','']); setMessage('Your Book Poll is live!'); setCreating(false); await loadPolls();
  }

  async function deletePoll(poll) {
    if (!user || poll.creator_id !== user.id || deleting[poll.id]) return;
    if (!window.confirm('Delete this poll? This cannot be undone.')) return;
    setDeleting(old => ({ ...old, [poll.id]: true }));
    setMessage('');
    const { error } = await supabase.from('community_polls').delete()
      .eq('id', poll.id).eq('creator_id', user.id);
    if (error) {
      console.error('Could not delete poll:', error);
      setMessage('Could not delete this poll. Please refresh and try again.');
    } else {
      setPolls(old => old.filter(item => item.id !== poll.id));
      setMessage('Poll deleted.');
    }
    setDeleting(old => ({ ...old, [poll.id]: false }));
  }

  async function vote(poll, optionId) {
    if (!user) { setMessage('Log in to vote in Book Polls.'); return; }
    if ((poll.community_poll_votes || []).some(v => v.user_id === user.id) || voting[poll.id]) return;
    setVoting(old => ({ ...old, [poll.id]: true })); setMessage('');
    const { error } = await supabase.from('community_poll_votes').insert({ poll_id: poll.id, option_id: optionId, user_id: user.id });
    if (error) {
      console.error('Could not save vote:', error);
      setMessage(error.code === '23505' ? 'You have already voted in this poll.' : 'Your vote could not be saved. Please try again.');
    } else { setMessage('Your vote has been counted.'); await loadPolls(); }
    setVoting(old => ({ ...old, [poll.id]: false }));
  }

  return <section className="community-polls stack" aria-labelledby="community-polls-title">
    <div className="community-section-heading"><div><p className="mono">HAVE YOUR SAY</p><h2 className="h2" id="community-polls-title">Book Polls</h2><p className="fine">Choose a side, see what readers think, and start a story conversation.</p></div></div>
    {message && <p className="notice" role="status">{message}</p>}
    {user ? <form className="community-poll-create stack" onSubmit={createPoll}>
      <label className="field"><span>Your poll question</span><input className="in" maxLength={200} value={question} onChange={e => setQuestion(e.target.value)} placeholder="Which kind of ending stays with you?" /></label>
      <div className="community-poll-option-editor">{options.map((value, i) => <label className="field" key={i}><span>Option {i+1}</span><input className="in" maxLength={100} value={value} onChange={e => setOptions(old => old.map((x,j) => j === i ? e.target.value : x))} placeholder={i===0 ? 'A hopeful ending' : i===1 ? 'A heartbreaking twist' : 'Another answer'} /></label>)}</div>
      <div className="community-poll-create-actions">
        {options.length < 6 && <button type="button" className="btn ghost small" onClick={() => setOptions(old => [...old,''])}>＋ Add option</button>}
        {options.length > 2 && <button type="button" className="linkbtn" onClick={() => setOptions(old => old.slice(0,-1))}>Remove last option</button>}
        <button className="btn small" disabled={creating}>{creating ? 'Publishing…' : 'Publish poll'}</button>
      </div>
    </form> : <p className="muted"><a className="linkbtn" href="/login?next=%2Fcommunity">Log in</a> to create a poll or vote.</p>}
    {loading && <p className="muted">Loading Book Polls…</p>}
    {!loading && polls.length === 0 && <div className="community-poll-empty"><b>No polls yet.</b><p>Start the first one and let the community decide.</p></div>}
    {polls.map(poll => {
      const votes = poll.community_poll_votes || [], opts = poll.community_poll_options || [];
      const mine = user && votes.find(v => v.user_id === user.id), total = votes.length;
      return <article className="community-poll-card" key={poll.id}>
        <div className="community-poll-byline"><span className="community-poll-mark" aria-hidden="true">✦</span><span><b>{poll.profiles?.name || 'Palixia reader'}</b><span className="fine"> asked the community</span></span><span className="community-poll-vote-count">{total} {total===1?'vote':'votes'}</span>{user && user.id === poll.creator_id && <button type="button" className="linkbtn" onClick={() => deletePoll(poll)} disabled={Boolean(deleting[poll.id])} aria-label="Delete your poll">{deleting[poll.id] ? 'Deleting…' : 'Delete'}</button>}</div>
        <h3>{poll.question}</h3>
        <div className="community-poll-choices">{opts.map(option => {
          const count = votes.filter(v => v.option_id === option.id).length, pct = total ? Math.round(count/total*100) : 0;
          return <button key={option.id} type="button" className={'community-poll-choice' + (mine?.option_id === option.id ? ' chosen' : '')} onClick={() => !mine && vote(poll, option.id)} disabled={Boolean(mine) || Boolean(voting[poll.id])}>
            <span className="community-poll-choice-label">{option.option_text}</span>
            {mine && <span className="community-poll-result"><span style={{width:pct+'%'}} /><b>{pct}%</b></span>}
          </button>;
        })}</div>
        <p className="fine">{mine ? 'Results shown · ' + total + ' total votes' : user ? 'Choose one answer to reveal the results.' : 'Log in to vote and see the results.'}</p>
      </article>;
    })}
  </section>;
}
