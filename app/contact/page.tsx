const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@tooltrack.ie";

export default function ContactPage() {
  return <div className="pageWidth pagePad narrowContent contentPage">
    <p className="eyebrow red">Contact</p>
    <h1>Contact ToolTrack</h1>
    <div className="settingsCard">
      <h2>Support</h2>
      <p>For account, privacy, stolen-record, dispute or shop questions, contact us at <a className="textLink" href={`mailto:${supportEmail}`}>{supportEmail}</a>.</p>
      <p className="muted">Do not email passwords, payment-card information or unnecessary copies of personal documents. Include a ToolTrack reference where available.</p>
    </div>
  </div>;
}
