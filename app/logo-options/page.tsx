import Link from "next/link";

const logoOptions = [
  { number: "01", name: "Wordmark + track line", description: "Clean trade-site wordmark with a small tracking line under the red half.", className: "wordmark" },
  { number: "02", name: "Stamped TT mark", description: "Simple stamped TT block beside the ToolTrack wordmark.", className: "stamp" },
  { number: "03", name: "Serial check mark", description: "Minimal barcode/check symbol for the public serial lookup idea.", className: "serial" },
] as const;

function LogoPreview({ className }: { className: "wordmark" | "stamp" | "serial" }) {
  if (className === "stamp") {
    return <div className="cleanLogo cleanLogoStamp"><span className="ttStamp">TT</span><span className="cleanWord">TOOL<span>TRACK</span></span></div>;
  }
  if (className === "serial") {
    return <div className="cleanLogo cleanLogoSerial"><span className="serialMark"><i /><i /><i /><b /></span><span className="cleanWord">TOOL<span>TRACK</span></span></div>;
  }
  return <div className="cleanLogo cleanLogoWordmark"><span className="cleanWord">TOOL<span>TRACK</span></span><span className="trackLine" /></div>;
}

export default function LogoOptionsPage() {
  return (
    <main className="pageWidth pagePad logoOptionsPage">
      <Link className="backLink" href="/">← Back to ToolTrack</Link>
      <div className="pageIntro">
        <p className="eyebrow red">ToolTrack V4.8</p>
        <h1>Logo options</h1>
        <p>Three cleaner routes using simple shapes and readable wordmarks. No mascot, no shield, no overworked pictogram.</p>
      </div>

      <div className="logoOptionGrid">
        {logoOptions.map((option) => (
          <article className="logoOptionCard" key={option.name}>
            <div className="logoOptionNumber">{option.number}</div>
            <div className={`logoPreview logoPreview-${option.className}`}><LogoPreview className={option.className} /></div>
            <h2>{option.name}</h2>
            <p>{option.description}</p>
          </article>
        ))}
      </div>
    </main>
  );
}
