import Link from "next/link";

export function Brand({ onClick, href = "/" }: { onClick?: () => void; href?: string }) {
  return (
    <Link className="brand" href={href} aria-label="ToolTrack home" onClick={onClick}>
      <span className="brandMark">TT</span>
      <span className="brandText">TOOL<span>TRACK</span></span>
    </Link>
  );
}
