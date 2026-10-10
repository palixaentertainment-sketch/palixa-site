'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase, configured } from '@/lib/supabase';

const TRIVIA_QUESTIONS = [
  { q: 'Who wrote the Harry Potter book series?', options: ['Suzanne Collins', 'J.K. Rowling', 'Stephen King', 'Rick Riordan'], answer: 'J.K. Rowling', note: 'J.K. Rowling created the Harry Potter series.' },
  { q: 'Who is the author of Pride and Prejudice?', options: ['Jane Austen', 'Emily Brontë', 'Mary Shelley', 'Virginia Woolf'], answer: 'Jane Austen', note: 'Jane Austen published Pride and Prejudice in 1813.' },
  { q: 'Which fictional detective lives at 221B Baker Street?', options: ['Hercule Poirot', 'Nancy Drew', 'Sherlock Holmes', 'Philip Marlowe'], answer: 'Sherlock Holmes', note: 'Sherlock Holmes is the famous detective created by Arthur Conan Doyle.' },
  { q: 'Who wrote Things Fall Apart?', options: ['Wole Soyinka', 'Chinua Achebe', 'Ngũgĩ wa Thiong’o', 'Ben Okri'], answer: 'Chinua Achebe', note: 'Chinua Achebe’s novel was first published in 1958.' },
  { q: 'In The Lord of the Rings, what is the name of the hobbit who carries the One Ring for much of the story?', options: ['Bilbo Baggins', 'Samwise Gamgee', 'Frodo Baggins', 'Peregrin Took'], answer: 'Frodo Baggins', note: 'Frodo Baggins is entrusted with the dangerous journey to destroy the Ring.' },
  { q: 'Who wrote the novel Frankenstein?', options: ['Mary Shelley', 'Agatha Christie', 'Louisa May Alcott', 'George Eliot'], answer: 'Mary Shelley', note: 'Mary Shelley’s Frankenstein was published in 1818.' },
  { q: 'What is the name of the school attended by Harry Potter?', options: ['Camp Half-Blood', 'Hogwarts', 'Brakebills', 'Nevermore'], answer: 'Hogwarts', note: 'Hogwarts School of Witchcraft and Wizardry is central to the series.' },
  { q: 'Who wrote the epic poem The Odyssey?', options: ['Virgil', 'Homer', 'Sophocles', 'Plato'], answer: 'Homer', note: 'The Odyssey is an ancient Greek epic traditionally attributed to Homer.' },
  { q: 'Which author created the detective Hercule Poirot?', options: ['Agatha Christie', 'Arthur Conan Doyle', 'Dorothy L. Sayers', 'Raymond Chandler'], answer: 'Agatha Christie', note: 'Poirot appears in many mysteries by Agatha Christie.' },
  { q: 'What kind of animal is Aslan in The Chronicles of Narnia?', options: ['Tiger', 'Eagle', 'Lion', 'Wolf'], answer: 'Lion', note: 'Aslan is the great lion in C.S. Lewis’s Narnia stories.' },
];

const GUESS_QUESTIONS = [
  { q: 'A young wizard discovers he is famous in the magical world and attends a school called Hogwarts. Which book series is this?', options: ['Percy Jackson', 'Harry Potter', 'The Hunger Games', 'The Chronicles of Narnia'], answer: 'Harry Potter' },
  { q: 'A young woman named Elizabeth Bennet navigates love, manners, and social expectations. Name the novel.', options: ['Jane Eyre', 'Little Women', 'Pride and Prejudice', 'Wuthering Heights'], answer: 'Pride and Prejudice' },
  { q: 'A lion, a wardrobe, and a magical land called Narnia are at the heart of this classic fantasy story.', options: ['The Hobbit', 'The Lion, the Witch and the Wardrobe', 'Peter Pan', 'Alice’s Adventures in Wonderland'], answer: 'The Lion, the Witch and the Wardrobe' },
  { q: 'A farm rebellion becomes a sharp political fable, with pigs taking leadership. Which book is it?', options: ['Animal Farm', 'Watership Down', 'Lord of the Flies', 'The Jungle Book'], answer: 'Animal Farm' },
  { q: 'Okonkwo’s life and his community’s encounter with colonial change are central to this Nigerian classic.', options: ['The Famished Road', 'Purple Hibiscus', 'Things Fall Apart', 'Half of a Yellow Sun'], answer: 'Things Fall Apart' },
];

function makePalixiaQuestions(books) {
  const usable = (books || []).filter((b) => b.title && b.author_name);
  const authors = [...new Set(usable.map((b) => b.author_name))];
  const titles = [...new Set(usable.map((b) => b.title))];
  const genres = [...new Set(usable.map((b) => b.genre_name).filter(Boolean))];
  const questions = [];

  if (authors.length > 1 && titles.length > 1) {
    usable.forEach((book) => {
      if (questions.length >= 10) return;
      const options = [book.author_name, ...authors.filter((name) => name !== book.author_name)].slice(0, 4);
      if (options.length > 1) questions.push({
        q: 'Who wrote “' + book.title + '”?',
        options: options.sort(() => Math.random() - 0.5),
        answer: book.author_name,
        note: '“' + book.title + '” is listed on Palixia under ' + book.author_name + '.',
      });
    });
  }
  if (titles.length > 1) {
    usable.forEach((book) => {
      if (questions.length >= 10) return;
      const options = [book.title, ...titles.filter((title) => title !== book.title)].slice(0, 4);
      if (options.length > 1) questions.push({
        q: 'Which of these titles is a book published on Palixia?',
        options: options.sort(() => Math.random() - 0.5),
        answer: book.title,
        note: '“' + book.title + '” is available on Palixia.',
      });
    });
  }
  if (genres.length > 1) {
    usable.forEach((book) => {
      if (questions.length >= 10 || !book.genre_name) return;
      const options = [book.genre_name, ...genres.filter((genre) => genre !== book.genre_name)].slice(0, 4);
      if (options.length > 1) questions.push({
        q: 'Which genre is listed for “' + book.title + '”?',
        options: options.sort(() => Math.random() - 0.5),
        answer: book.genre_name,
        note: 'Palixia lists “' + book.title + '” under ' + book.genre_name + '.',
      });
    });
  }
  return questions;
}

const MODES = [
  { id: 'trivia', icon: '🧠', title: 'Book Trivia', text: 'Famous books, authors, and unforgettable characters.', detail: '10 questions' },
  { id: 'guess', icon: '🔎', title: 'Guess the Book', text: 'Use story clues to identify a well-known book.', detail: '5 clues' },
  { id: 'palixia', icon: '📚', title: 'Palixia Books Quiz', text: 'Test your knowledge of books and authors published here.', detail: 'Uses Palixia book listings' },
];

export default function GamesPage() {
  const [mode, setMode] = useState(null);
  const [books, setBooks] = useState([]);
  const [booksLoading, setBooksLoading] = useState(true);
  const [index, setIndex] = useState(0);
  const [chosen, setChosen] = useState(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadBooks() {
      if (!configured) {
        setBooksLoading(false);
        return;
      }
      const { data, error } = await supabase.from('book_cards').select('id,title,author_name,genre_name,description').limit(100);
      if (active && !error) setBooks(data || []);
      if (active) setBooksLoading(false);
    }
    loadBooks();
    return () => { active = false; };
  }, []);

  const palixiaQuestions = useMemo(() => makePalixiaQuestions(books), [books]);
  const questions = mode === 'trivia' ? TRIVIA_QUESTIONS : mode === 'guess' ? GUESS_QUESTIONS : palixiaQuestions;
  const current = questions[index];

  function start(nextMode) {
    setMode(nextMode);
    setIndex(0);
    setChosen(null);
    setScore(0);
    setFinished(false);
  }

  function choose(option) {
    if (chosen !== null || !current) return;
    setChosen(option);
    if (option === current.answer) setScore((value) => value + 100);
  }

  function next() {
    if (index + 1 >= questions.length) setFinished(true);
    else {
      setIndex((value) => value + 1);
      setChosen(null);
    }
  }

  return (
    <main className="wrap games-page">
      <div className="games-heading">
        <Link href="/" className="games-back">← Back to Palixia</Link>
        <span className="home-eyebrow">A LITTLE FUN FOR BOOK LOVERS</span>
        <h1>Palixia Games</h1>
        <p>Play a quick quiz, test your book knowledge, and discover stories from our community.</p>
      </div>

      {!mode && (
        <section className="games-grid" aria-label="Choose a game">
          {MODES.map((game) => (
            <article className="games-card" key={game.id}>
              <div className="games-card-icon" aria-hidden="true">{game.icon}</div>
              <span className="games-card-detail">{game.detail}</span>
              <h2>{game.title}</h2>
              <p>{game.text}</p>
              {game.id === 'palixia' && booksLoading ? (
                <button className="btn games-play" type="button" disabled>Loading books…</button>
              ) : game.id === 'palixia' && palixiaQuestions.length === 0 ? (
                <button className="btn games-play" type="button" disabled>More books needed</button>
              ) : (
                <button className="btn games-play" type="button" onClick={() => start(game.id)}>Play now <span aria-hidden="true">→</span></button>
              )}
              {game.id === 'palixia' && palixiaQuestions.length === 0 && !booksLoading && (
                <p className="games-card-note">This quiz needs at least two published book titles or authors to make fair multiple-choice questions.</p>
              )}
            </article>
          ))}
        </section>
      )}

      {mode && !finished && current && (
        <section className="games-quiz" aria-live="polite">
          <div className="games-quiz-top">
            <button className="games-text-button" type="button" onClick={() => start(null)}>← All games</button>
            <span>{index + 1} / {questions.length}</span>
          </div>
          <div className="games-progress" role="progressbar" aria-valuemin="0" aria-valuemax={questions.length} aria-valuenow={index + 1}>
            <span style={{ width: (((index + 1) / questions.length) * 100) + '%' }} />
          </div>
          <p className="games-question-kicker">{MODES.find((item) => item.id === mode)?.title}</p>
          <h2>{current.q}</h2>
          <div className="games-options">
            {current.options.map((option) => {
              const isAnswer = option === current.answer;
              const isChosen = option === chosen;
              const stateClass = chosen === null ? '' : isAnswer ? ' is-correct' : isChosen ? ' is-wrong' : '';
              return (
                <button key={option} type="button" className={'games-option' + stateClass} onClick={() => choose(option)} disabled={chosen !== null}>
                  <span>{String.fromCharCode(65 + current.options.indexOf(option))}</span>{option}
                </button>
              );
            })}
          </div>
          {chosen !== null && (
            <div className={'games-feedback' + (chosen === current.answer ? ' feedback-correct' : ' feedback-wrong')}>
              <b>{chosen === current.answer ? 'That’s right! +100 points' : 'Not quite!'}</b>
              <p>{current.note || 'The correct answer is ' + current.answer + '.'}</p>
              <button className="btn" type="button" onClick={next}>{index + 1 === questions.length ? 'See results' : 'Next question →'}</button>
            </div>
          )}
          <p className="games-score">Score: <strong>{score}</strong></p>
        </section>
      )}

      {mode && (finished || (!current && mode === 'palixia' && !booksLoading)) && (
        <section className="games-results">
          <span className="games-result-icon" aria-hidden="true">🏆</span>
          <span className="home-eyebrow">QUIZ COMPLETE</span>
          <h2>{finished ? 'Nice work!' : 'More stories, more questions'}</h2>
          <p>{finished ? 'You scored ' + score + ' points out of ' + (questions.length * 100) + '.' : 'There aren’t enough published books yet to build this quiz. Check back as more authors publish on Palixia.'}</p>
          {finished && <p className="games-result-detail">{Math.round((score / (questions.length * 100)) * 100)}% correct · {score / 100} of {questions.length} answers right</p>}
          <div className="games-result-actions">
            {finished && <button className="btn" type="button" onClick={() => start(mode)}>Play again</button>}
            <button className="btn ghost" type="button" onClick={() => start(null)}>Choose another game</button>
            <Link className="btn ghost" href="/discover">Discover books</Link>
          </div>
        </section>
      )}

      <div className="games-footer-note">Made for readers and the people who create the stories they love.</div>
    </main>
  );
}
