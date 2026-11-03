export const metadata = {
  title: 'Contact Us',
  description: 'Contact Palixia for reader support, author help, privacy requests, copyright reports and business enquiries.',
};

const contacts = [
  { title: 'Reader support', description: 'Help with reading, your library, account access or general feedback.', subject: 'Reader support' },
  { title: 'Author support', description: 'Publishing questions, story management and author dashboard issues.', subject: 'Author support' },
  { title: 'Privacy and account requests', description: 'Requests to access, correct or delete personal information or an account.', subject: 'Privacy or account request' },
  { title: 'Copyright reports', description: 'Report material that you believe infringes your copyright or other rights.', subject: 'Copyright report' },
  { title: 'Business enquiries', description: 'Partnerships, media enquiries and other opportunities.', subject: 'Business enquiry' },
];

export default function ContactPage() {
  return (
    <div className="stack">
      <header className="stack narrow">
        <p className="mono">We’re here to help</p>
        <h1 className="h1">Contact Us</h1>
        <p className="muted">Choose the topic that best describes your message. All enquiries are handled through our main support address.</p>
        <p><a className="linkbtn" href="mailto:info@palixia.com">info@palixia.com</a></p>
        <p className="fine">For account or privacy requests, write from the email address associated with your Palixia account where possible. Never email your password or one-time sign-in code.</p>
      </header>

      <section className="grid" aria-label="Contact options">
        {contacts.map((contact) => (
          <article className="card" key={contact.title}>
            <h2 className="h2">{contact.title}</h2>
            <p className="muted">{contact.description}</p>
            <p><a className="btn ghost" href={`mailto:info@palixia.com?subject=${encodeURIComponent(contact.subject)}`}>Email us</a></p>
          </article>
        ))}
      </section>
    </div>
  );
}
