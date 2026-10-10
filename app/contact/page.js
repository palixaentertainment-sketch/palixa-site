export const metadata = { title: 'Contact Us' };

const contacts = [
  {
    title: 'For authors',
    description: 'Publishing questions and account problems.',
    subject: 'Author support',
  },
  {
    title: 'For readers',
    description: 'Reading problems and general feedback.',
    subject: 'Reader support',
  },
  {
    title: 'For business enquiries',
    description: 'Partnerships and other opportunities.',
    subject: 'Business enquiry',
  },
];

export default function ContactPage() {
  return (
    <div className="stack">
      <header className="stack narrow">
        <p className="mono">We’re here to help</p>
        <h1 className="h1">Contact Us</h1>
        <p className="muted">
          Have a question or something to share with Palixia? Choose the topic
          that best describes your message and email us.
        </p>
        <p>
          <a className="linkbtn" href="mailto:palixia.official@gmail.com">
            palixia.official@gmail.com
          </a>
        </p>
      </header>

      <section className="grid" aria-label="Contact options">
        {contacts.map((contact) => (
          <article className="card" key={contact.title}>
            <h2 className="h2">{contact.title}</h2>
            <p className="muted">{contact.description}</p>
            <p>
              <a
                className="btn ghost"
                href={`mailto:palixia.official@gmail.com?subject=${encodeURIComponent(contact.subject)}`}
              >
                Email us
              </a>
            </p>
          </article>
        ))}
      </section>
    </div>
  );
}
