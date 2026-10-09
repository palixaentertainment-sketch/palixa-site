export const metadata = { title: 'Privacy Policy' };

export default function Privacy() {
  return (
    <div className="stack narrow legal">
      <h1 className="h1">Privacy Policy</h1>
      <p className="fine">Last updated 9 October 2026</p>
      <p>This page explains what information Palixia collects, why, and the choices you have.</p>

      <h2 className="h2">What we collect</h2>
      <ul>
        <li><b>Account details:</b> your name, username and email address, and a password, which is stored in protected form and never visible to us. If you sign in with Google, we receive your name and email from Google.</li>
        <li><b>Profile details you choose to add:</b> a short bio, country and profile picture.</li>
        <li><b>Your work:</b> books, covers, chapters and comic pages you publish.</li>
        <li><b>Your activity:</b> books you save, authors you follow, where you stopped reading, and read counts for books.</li>
      </ul>

      <h2 className="h2">How we use it</h2>
      <ul>
        <li>To run your account, show your profile and published work, and remember your place in books.</li>
        <li>To show authors how many reads and followers they have.</li>
        <li>To keep the site safe, and to respond if you contact us.</li>
      </ul>
      <p>We do not sell your personal information.</p>

      <h2 className="h2">What other people can see</h2>
      <p>Your name, username, bio, country, profile picture and published books are public. Your email address, your saved books and your reading progress are private to you.</p>

      <h2 className="h2">Who handles your data</h2>
      <p>Palixia relies on trusted services to run: Supabase stores accounts and content, Vercel hosts the website, and Google provides sign-in if you choose it. They process data only to provide those services.</p>

      <h2 className="h2">Cookies and storage</h2>
      <p>We use your browser's storage to keep you signed in. We do not use it for advertising.</p>

      <h2 className="h2">Your choices</h2>
      <ul>
        <li>You can edit your name, bio, country and picture from your profile.</li>
        <li>You can unpublish or delete your books and chapters at any time.</li>
        <li>You can ask us to show, correct or delete your account and the data we hold about you by messaging Palixia Entertainment on X at @PALIXIANOVEL.</li>
      </ul>

      <h2 className="h2">Children</h2>
      <p>Palixia is not meant for young children. If you believe a child has given us personal information without a parent or guardian's permission, contact us and we will remove it.</p>

      <h2 className="h2">Changes</h2>
      <p>We may update this policy as Palixia grows. The date at the top shows when it last changed.</p>
    </div>
  );
}
