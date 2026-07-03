import Link from "next/link";

export function Brand({ onClick, href = "/" }: { onClick?: () => void; href?: string }) {
  return (
    <Link className="brand" href={href} aria-label="ToolTrack home" onClick={onClick}>
      <span className="brandMark" aria-hidden="true">
        <svg viewBox="0 0 40 40" role="img">
          <path d="M20 3 34 9v10c0 9-5.8 15-14 18C11.8 34 6 28 6 19V9l14-6Z" />
          <path d="M13 15h14M20 10v20M13 25h14" />
          <circle cx="13" cy="15" r="2" />
          <circle cx="27" cy="15" r="2" />
          <circle cx="13" cy="25" r="2" />
          <circle cx="27" cy="25" r="2" />
        </svg>
      </span>
      <span className="brandText">TOOL<span>TRACK</span></span>
    </Link>
  );
}
