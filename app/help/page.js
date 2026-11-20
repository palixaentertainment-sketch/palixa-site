import Link from 'next/link';

export const metadata = {
  title: 'Help Centre',
  description: 'Find answers to common questions about reading, publishing and using Palixia.',
};

const faqs = [
  {
    category: 'Accounts',
    items: [
      ['I can’t log in. What should I do?', 'Check that you are using the email address linked to your Palixia account. If you signed up with Google, try the Google sign-in option. If the problem continues, contact support and describe the error. Never send us your password or a one-time sign-in code.'],
      ['How do I update my account details?', 'Sign in to Palixia and open your profile or account settings. If you cannot access your account or a detail cannot be changed, contact support from the email address associated with the account where possible.'],
    ],
  },
  {
    category: 'Reading',
    items: [
      ['How do I find a book?', 'Visit Discover to browse stories, use the available filters, or search for a title, author or genre. Open a book page to see its description and available chapters.'],
      ['Where can I find books I have saved?', 'Your Library keeps track of your reading shelves and saved books. Sign in to access your personal library and reading activity.'],
      ['A chapter is not opening. What should I do?', 'Refresh the page and try again. If the issue continues, contact support with the book title, chapter number and a short description of what happened.'],
    ],
  },
  {
    category: 'Publishing',
    items: [
      ['How do I publish on Palixia?', 'Create an account, open your author dashboard and use the publishing tools to add your book details, cover and chapters. Follow the on-screen instructions and check your book before publishing.'],
      ['Can I edit my book after publishing?', 'Use your author dashboard to manage your book and its chapters. If an editing option is unavailable or something is not saving correctly, contact author support.'],
      ['My book or chapter is not appearing. What should I do?', 'Check its publication status in your author dashboard first. If it is marked as published but still does not appear, send support the book title and the affected chapter.'],
    ],
  },
  {
    category: 'Payments and author support',
    items: [
      ['How can readers support authors?', 'Palixia Sparks is our reader-to-author support feature. Readers will be able to support authors whose stories they enjoy. Sparks is currently in pre-launch preparation; sending support is not open yet. Never send money outside Palixia claiming it is an official Sparks payment.'],
      ['Where can I ask about a payment or wallet issue?', 'Use the Contact Support page and choose the closest topic. Include the date and relevant transaction reference if one exists, but never send card details, passwords or one-time codes.'],
    ],
  },
  {
    category: 'Safety and reporting',
    items: [
      ['How do I report a problem or inappropriate content?', 'Contact Palixia and explain what happened. Include the relevant book, chapter, comment or account details so the team can identify what you are reporting.'],
      ['How do I report copyright infringement?', 'Use the Contact Us page and choose Copyright reports. Include the work being reported, the material in question and information that helps us review the claim.'],
    ],
  },
];

export default function HelpCentrePage() {
  return (
    <div className="stack help-centre">
      <header className="help-hero">
        <p className="mono">PALIXIA SUPPORT</p>
        <h1 className="h1">How can we help?</h1>
        <p className="muted">Find answers about your account, reading, publishing and support on Palixia.</p>
        <Link className="btn" href="/contact">Contact Support <span aria-hidden="true">→</span></Link>
      </header>

      <div className="help-sections">
        {faqs.map((section) => (
          <section className="help-category" key={section.category}>
            <h2 className="h2">{section.category}</h2>
            <div className="help-faq-list">
              {section.items.map(([question, answer]) => (
                <details className="help-faq" key={question}>
                  <summary>{question}<span aria-hidden="true">+</span></summary>
                  <p>{answer}</p>
                </details>
              ))}
            </div>
          </section>
        ))}
      </div>

      <aside className="help-contact-card">
        <div>
          <p className="mono">STILL NEED A HAND?</p>
          <h2 className="h2">Talk to the Palixia team.</h2>
          <p className="muted">Tell us what you’re experiencing and we’ll direct your enquiry to the right support category.</p>
        </div>
        <Link className="btn" href="/contact">Get in touch</Link>
      </aside>
    </div>
  );
}
