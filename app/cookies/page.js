export const metadata = {
  title: 'Cookie Policy',
  description: 'How Palixia uses cookies and browser storage for sign-in, site operation and analytics.',
};

export default function CookiePolicy() {
  return (
    <article className="stack narrow legal">
      <p className="mono">SITE INFORMATION</p>
      <h1 className="h1">Cookie Policy</h1>
      <p className="fine">Last updated 3 November 2026</p>
      <p>This policy explains how Palixia uses cookies and similar technologies when you visit the website. Cookies are small files stored by a website or its providers in your browser. Similar technologies include local storage and other browser storage that can remember information between page visits.</p>

      <h2 className="h2">Essential authentication and site storage</h2>
      <p>Palixia uses browser storage to support sign-in and maintain your authenticated session. If you block or clear this storage, you may be signed out or some account features may not work correctly. The exact storage keys and expiry behaviour can depend on the authentication library and browser.</p>

      <h2 className="h2">Visitor analytics</h2>
      <p>Palixia's website code stores a randomly generated browser-session identifier in local storage and uses it to record page-view events. The event records include the page path and, when you are signed in, your account identifier. The visitor analytics table is not designed to store IP addresses. Hosting, database, authentication and security providers may separately process technical logs and request metadata.</p>

      <h2 className="h2">Advertising</h2>
      <p>Palixia does not currently load advertising scripts or serve ads through the website. If advertising is introduced, this policy will be updated to explain the technologies used and any choices available to visitors before they are enabled.</p>

      <h2 className="h2">Your choices</h2>
      <p>You can usually view, block or delete cookies and browser storage through your browser settings. Controls vary by browser and device. Blocking essential storage may affect sign-in and other features. Palixia currently uses essential sign-in storage and first-party visitor analytics as described above. No advertising technologies are currently loaded by the website.</p>

      <h2 className="h2">Changes and contact</h2>
      <p>We may update this policy if the website adds or changes cookies, analytics or advertising services. We will update the date at the top of this page. For questions, email <a href="mailto:info@palixia.com">info@palixia.com</a> and see our <a href="/privacy">Privacy Policy</a>.</p>
    </article>
  );
}
