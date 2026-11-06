export const metadata = {
  title: 'Reader Payment & Refund Policy',
  description: 'How Palixia handles Sparks purchases, author tips and eligible refund requests.',
};

export default function RefundPolicy() {
  return (
    <article className="stack narrow legal">
      <h1 className="h1">Reader Payment &amp; Refund Policy</h1>
      <p className="fine">Last updated 7 November 2026</p>
      <p>This policy explains how Palixia handles payment and refund questions in preparation for the launch of Sparks purchases and author-support features. Public Sparks purchases, author tips and withdrawals are not currently available. Do not send payment to anyone claiming to accept payment on Palixia's behalf outside an official Palixia payment flow.</p>

      <h2 className="h2">1. Sparks purchases</h2>
      <p>Sparks are platform credits intended for eligible support features, including tipping authors. Before a purchase is made, Palixia will display the applicable price, amount of Sparks and important purchase conditions. Once a payment is confirmed by the payment provider, Sparks should be credited to the reader's Palixia account, subject to server-side verification.</p>

      <h2 className="h2">2. When a purchase may be refunded</h2>
      <p>Readers may request a review if a payment was collected but Sparks were not credited, the same purchase was charged more than once, a transaction appears unauthorised, or a technical error caused an incorrect charge or credit.</p>
      <p>Palixia will verify the transaction and the status of the Sparks. Unused Sparks may support a refund review. Sparks already spent are not ordinarily refundable, except where required by law or where needed to correct an error, duplicate charge or unauthorised transaction.</p>

      <h2 className="h2">3. Tips to authors</h2>
      <p>A reader who uses Sparks to tip an author is choosing to support that author's work. A correctly completed tip is ordinarily final and is not refundable simply because the reader changes their mind or later disagrees with the content.</p>
      <p>A tip may be reviewed if it resulted from a duplicate transaction, unauthorised payment, technical error or another circumstance where a refund or reversal is required by law. Palixia will review the payment and related ledger entries before deciding how to correct it. Submitting a request does not guarantee a refund.</p>

      <h2 className="h2">4. How to request help or a refund</h2>
      <p>Contact <a href="mailto:info@palixia.com">info@palixia.com</a> using the email address associated with your Palixia account where possible. Include your username, the payment provider's transaction reference, the date and amount charged, and a short explanation. Do not email your password, one-time passcodes or full payment-card details. We may ask for reasonable information to verify the transaction.</p>

      <h2 className="h2">5. Approved refunds</h2>
      <p>Where a refund is approved, Palixia will normally request that it be returned through the original payment method, where supported by the payment provider. The time taken for funds to appear depends on the provider, bank and card issuer; Palixia cannot guarantee their processing times.</p>
      <p>Where appropriate, a confirmed crediting error may instead be corrected by adding missing Sparks or reversing an incorrect ledger entry, subject to applicable law. We will explain the resolution to the reader.</p>

      <h2 className="h2">6. Unauthorised payments</h2>
      <p>If you believe a payment was made without your permission, contact Palixia promptly and contact your bank or payment provider through its official channels. Palixia may temporarily restrict affected Sparks or account activity while investigating to prevent misuse or duplicate reimbursement.</p>

      <h2 className="h2">7. Legal rights and changes</h2>
      <p>This policy does not limit any refund, cancellation, chargeback or other consumer right that cannot lawfully be excluded. Where applicable law gives you a right that differs from this policy, the law applies.</p>
      <p>We may update this policy before public payment features launch or when provider requirements or applicable law changes. Material changes will be communicated through the platform where reasonably practical.</p>

      <h2 className="h2">8. Contact</h2>
      <p>For payment questions or refund requests, email <a href="mailto:info@palixia.com">info@palixia.com</a>.</p>
    </article>
  );
}
