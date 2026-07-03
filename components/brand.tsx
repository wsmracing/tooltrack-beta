import Link from "next/link";

export function Brand({ onClick, href = "/" }: { onClick?: () => void; href?: string }) {
  return (
    <Link className="brand" href={href} aria-label="ToolTrack home" onClick={onClick}>
      <span className="brandMark" aria-hidden="true">
        <svg viewBox="0 0 40 40" role="img">
          <rect x="4" y="4" width="32" height="32" rx="9" />
          <path d="M12 13h16M20 13v15" />
          <path d="M13 27h14" />
          <circle cx="12" cy="13" r="1.6" />
          <circle cx="28" cy="13" r="1.6" />
          <circle cx="13" cy="27" r="1.6" />
          <circle cx="27" cy="27" r="1.6" />
        </svg>
      </span>
      <span className="brandText">TOOL<span>TRACK</span></span>
    </Link>
  );
}
