import { initials } from '@/lib/format';

export default function Avatar({ src, name, size }) {
  const style = size ? { '--s': size } : undefined;
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className="avatar" src={src} alt="" style={style} />;
  }
  return <span className="avatar" style={style} aria-hidden="true">{initials(name)}</span>;
}
