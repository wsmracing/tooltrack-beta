import Link from "next/link";

export function Brand() {
  return (
    <Link className="brand" href="/" aria-label="ToolTrack home">
      <span className="brandMark">TT</span>
      <span className="brandText">TOOL<span>TRACK</span></span>
    </Link>
  );
}
