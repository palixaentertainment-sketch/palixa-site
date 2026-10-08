'use client';

export default function GlobalError({ reset }) {
  return (
    <div className="wrap page">
      <div className="empty">
        <div>
          <b>Something went wrong.</b>
          <p>Please try again. If it keeps happening, come back in a few minutes.</p>
        </div>
        <button type="button" className="btn" onClick={() => reset()}>Try again</button>
      </div>
    </div>
  );
}
