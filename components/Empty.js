import Link from 'next/link';

export default function Empty({ title, text, href, cta }) {
  return (
    <div className="empty">
      <div>
        <b>{title}</b>
        {text && <p>{text}</p>}
      </div>
      {href && <Link className="btn" href={href}>{cta}</Link>}
    </div>
  );
}
