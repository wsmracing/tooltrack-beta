import Link from "next/link";

const logoOptions = [
  {
    name: "Option 1 — Asset Tag",
    description: "A rugged serial-tag mark for tools, ownership records and theft checks.",
    mark: "tag",
  },
  {
    name: "Option 2 — TT Monogram",
    description: "A compact app-icon style mark using the ToolTrack initials.",
    mark: "monogram",
  },
  {
    name: "Option 3 — Search Badge",
    description: "A check/search focused mark for the public serial-number lookup service.",
    mark: "search",
  },
] as const;

function LogoMark({ mark }: { mark: "tag" | "monogram" | "search" }) {
  if (mark === "monogram") {
    return (
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <rect x="8" y="8" width="48" height="48" rx="14" />
        <path d="M18 22h28M25 22v24M39 22v24M20 42h24" />
      </svg>
    );
  }

  if (mark === "search") {
    return (
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <path d="M12 16h27c3 0 5 2 5 5v13c0 3-2 5-5 5H13l-6-11 5-12Z" />
        <path d="M19 23h15M19 32h12" />
        <circle cx="42" cy="41" r="8" />
        <path d="M48 47l8 8" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <path d="M13 16h37c3 0 5 2 5 5v22c0 3-2 5-5 5H14L6 32l7-16Z" />
      <path d="M20 24h25M20 40h25" />
      <path d="M25 31h14M32 31v13" />
      <path d="M48 23v18" />
    </svg>
  );
}

export default function LogoOptionsPage() {
  return (
    <main className="pageWidth pagePad logoOptionsPage">
      <Link className="backLink" href="/">← Back to ToolTrack</Link>
      <div className="pageIntro">
        <p className="eyebrow red">ToolTrack V4.8</p>
        <h1>Logo options</h1>
        <p>Three clean routes for the ToolTrack brand. Pick one and it can be applied across the header, app icon and beta pages.</p>
      </div>

      <div className="logoOptionGrid">
        {logoOptions.map((option) => (
          <article className="logoOptionCard" key={option.name}>
            <div className={`logoPreview logoPreview-${option.mark}`}>
              <LogoMark mark={option.mark} />
              <strong>TOOL<span>TRACK</span></strong>
            </div>
            <h2>{option.name}</h2>
            <p>{option.description}</p>
          </article>
        ))}
      </div>
    </main>
  );
}
