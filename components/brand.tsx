import Link from "next/link";

export function Brand({ onClick }: { onClick?: () => void }) {
  return (
    <Link className="brand" href="/" aria-label="ToolTrack home" onClick={onClick}>
      <span className="brandMark">TT</span>
      <span className="brandText">TOOL<span>TRACK</span></span>
    </Link>
  );
}
