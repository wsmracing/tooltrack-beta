import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return <div className="pageWidth pagePad legalPage"><p className="eyebrow red">Prototype policy</p><h1>Privacy by design</h1><p>ToolTrack stores receipts, invoices and ownership evidence privately. Public serial lookups are intentionally limited to asset status and non-identifying information.</p><h2>Prototype testing</h2><p>This beta is intended for test data only. Do not upload documents containing full payment-card details, bank information or unnecessary personal data.</p><h2>Public information</h2><p>A stolen lookup may show the make, model, category, masked serial number, general theft area and a ToolTrack reference. It does not expose the owner’s name, email, telephone number, exact address or private documents.</p><h2>Sighting reports</h2><p>Sighting details are visible only to the relevant asset owner and authorised ToolTrack personnel. A reporter’s email address is optional and is never published.</p><h2>Your control</h2><p>The account page allows beta users to update their display name, manage sighting-email preferences, export their account data and delete their test account.</p></div>;
}
