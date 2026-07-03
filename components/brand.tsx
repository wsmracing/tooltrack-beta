import Link from "next/link";

export function Brand({ onClick, href = "/" }: { onClick?: () => void; href?: string }) {
  return (
    <Link className="brand" href={href} aria-label="ToolTrack home" onClick={onClick}>
      <span className="brandMark" aria-hidden="true">
        <svg viewBox="0 0 40 40" role="img">
          <path className="brandTagBody" d="M8 10.5h24c2 0 3.5 1.5 3.5 3.5v12c0 2-1.5 3.5-3.5 3.5H8.5L4.5 20l4-9.5Z" />
          <path className="brandTrackLine" d="M12 15h16" />
          <path className="brandTrackLine" d="M12 25h16" />
          <path className="brandT" d="M15 19h10M20 19v8" />
          <path className="brandScan" d="M31 14v12" />
        </svg>
      </span>
      <span className="brandText">TOOL<span>TRACK</span></span>
    </Link>
  );
}
