import type { Metadata } from "next";
export const metadata: Metadata = { title: "Contact" };
export default function ContactPage() {
  return <div className="pageWidth pagePad narrowPage"><p className="eyebrow red">Support</p><h1>Contact ToolTrack</h1><div className="settingsCard"><p>ToolTrack is currently in private beta.</p><p>For testing feedback or support, email <a className="textLink" href="mailto:support@tooltrack.ie">support@tooltrack.ie</a>.</p></div></div>;
}
