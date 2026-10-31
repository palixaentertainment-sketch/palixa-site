import Image from 'next/image';
import { initials } from '@/lib/format';

export default function Avatar({ src, name, size }) {
  const style = size ? { '--s': size } : undefined;
  if (src) {
    const optimizable = /^https:\/\/[^/]+\.supabase\.co\/storage\/v1\//i.test(src);
    if (optimizable) {
      return <Image className="avatar" src={src} alt="" width={128} height={128} sizes={size || '2.6rem'} quality={72} style={style} />;
    }
    // Keep compatibility with existing Google and other external avatar URLs.
    // eslint-disable-next-line @next/next/no-img-element
    return <img className="avatar" src={src} alt="" loading="lazy" decoding="async" style={style} />;
  }
  return <span className="avatar" style={style} aria-hidden="true">{initials(name)}</span>;
}
