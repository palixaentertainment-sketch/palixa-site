'use client';

import Link from 'next/link';
import Guard from '@/components/Guard';

function EarningsComingSoon() {
  return (
    <div className="stack">
      <div>
        <Link href="/dashboard" className="fine">← Back to dashboard</Link>
        <h1 className="h1">Author earnings</h1>
      </div>
      <section className="card stack">
        <span className="badge">Coming soon</span>
        <h2 className="h2">A home for your future earnings</h2>
        <p>We're preparing the Palixia author wallet so you can see support from readers, track your earnings and follow the status of your transactions.</p>
        <div className="stats">
          <div className="stat"><span className="mono">Author share</span><b>90%</b></div>
          <div className="stat"><span className="mono">Palixia share</span><b>10%</b></div>
          <div className="stat"><span className="mono">Withdrawals</span><b>Not available</b></div>
        </div>
        <p className="fine">These are the planned shares for reader tips. Tips are not being collected yet, and no earnings or withdrawals are currently available.</p>
        <p>We'll announce when the wallet and tipping feature are ready. You do not need to accept an agreement or provide payment details at this stage.</p>
        <div><Link href="/dashboard" className="btn">Return to dashboard</Link></div>
      </section>
    </div>
  );
}

export default function AuthorWalletPage() {
  return <Guard roles={['author','admin']}><EarningsComingSoon /></Guard>;
}
