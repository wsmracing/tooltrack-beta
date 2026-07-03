import Link from "next/link";

export function Brand({ onClick, href = "/" }: { onClick?: () => void; href?: string }) {
  return (
    <Link className="brand brandWordmarkLogo" href={href} aria-label="ToolTrack home" onClick={onClick}>
      <span className="brandText">TOOL<span>TRACK</span></span>
      <span className="brandTrackLine" aria-hidden="true" />
    </Link>
  );
}
