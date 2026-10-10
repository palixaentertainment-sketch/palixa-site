export const metadata = { title: 'Privacy Policy' };

export default function Privacy() {
  return (
    <div className="stack narrow legal">
      <h1 className="h1">Privacy Policy</h1>
      <p className="fine">Last updated 10 October 2026</p>
      <p>This policy explains how Palixia handles personal information when you use our developing book and comic publishing platform. It is written to describe the service as it currently operates; details may change as features are added.</p>

      <h2 className="h2">Information we collect</h2>
      <ul>
        <li><b>Account information:</b> information such as your name, username and email address that you provide when creating or managing an account.</li>
        <li><b>Content and activity:</b> books, chapters, covers, profile details, comments, posts, bookmarks, reading progress and other information you choose to submit or generate through site features.</li>
        <li><b>Messages:</b> information you include when contacting us for support or sending a report.</li>
        <li><b>Technical information:</b> information that may be recorded by the website, hosting, authentication or security services to operate the site, diagnose errors, prevent abuse and protect accounts. This may include device/browser information, log data and IP address.</li>
      </ul>
      <p>We do not ask you to send passwords, authentication codes, or financial account credentials by email. Do not include sensitive information in public posts or book content.</p>

      <h2 className="h2">How we use information</h2>
      <p>We use information to create and manage accounts; publish and display books and profiles; provide reading, library, bookmark and community features; respond to questions and reports; maintain, secure and improve the platform; prevent spam, fraud and misuse; and comply with legal obligations.</p>

      <h2 className="h2">Public information</h2>
      <p>Content you choose to publish publicly—such as your username, author profile, books, covers, comments or posts—may be visible to other users and may be copied or shared by them. Do not publish information you want to keep private. Account details such as your login credentials are not intended to be publicly displayed.</p>

      <h2 className="h2">Service providers and sharing</h2>
      <p>Palixia uses third-party infrastructure providers to operate the platform, including Supabase for database/authentication services and Vercel for hosting and deployment. Those providers may process information as needed to deliver their services under their own terms and privacy practices. We may also disclose information when reasonably necessary to respond to lawful requests, protect users or rights, investigate abuse, or handle a business transfer. We do not sell personal information as a product.</p>

      <h2 className="h2">Storage, security and retention</h2>
      <p>Information is stored using the platform's database, authentication and hosting services. We use reasonable technical and organisational measures appropriate to a developing service, but no internet service can guarantee absolute security. We keep information for as long as reasonably needed to operate the account and features, resolve disputes, maintain security, or meet legal obligations. Backups and logs may persist for a limited period after content or an account is removed.</p>

      <h2 className="h2">Your choices and requests</h2>
      <p>You can choose what public content you post and can contact us to request access to, correction of, or deletion of personal information, subject to applicable law and legitimate retention needs. You can also request removal of published work. We may need to verify that a request comes from the relevant account holder before acting.</p>

      <h2 className="h2">Children</h2>
      <p>Palixia is not intended to be used by children in a way that violates applicable age or consent requirements. If you believe a child has provided personal information inappropriately, contact us so we can review the concern.</p>

      <h2 className="h2">International processing</h2>
      <p>Our infrastructure providers may store or process information in countries other than your own. Where applicable law requires safeguards for cross-border processing, we will take steps required by that law.</p>

      <h2 className="h2">Changes and contact</h2>
      <p>We may update this policy as the platform develops. We will update the date above when changes are made. For privacy questions or requests, email palixia.official@gmail.com.</p>
      <p className="fine">This policy is a working draft based on the current known platform setup. Before inviting the public, verify the actual data flows, retention settings and applicable legal requirements, including Nigerian data-protection law where applicable. Consider legal review before publication.</p>
    </div>
  );
}
