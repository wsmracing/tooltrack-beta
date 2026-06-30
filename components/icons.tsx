import type { SVGProps } from "react";

const base = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export function SearchIcon(props: SVGProps<SVGSVGElement>) { return <svg {...base} {...props}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>; }
export function ToolboxIcon(props: SVGProps<SVGSVGElement>) { return <svg {...base} {...props}><path d="M4 8h16v11H4z"/><path d="M9 8V5h6v3M4 12h16M10 12v2h4v-2"/></svg>; }
export function PlusIcon(props: SVGProps<SVGSVGElement>) { return <svg {...base} {...props}><path d="M12 5v14M5 12h14"/></svg>; }
export function UserIcon(props: SVGProps<SVGSVGElement>) { return <svg {...base} {...props}><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>; }
export function ShieldIcon(props: SVGProps<SVGSVGElement>) { return <svg {...base} {...props}><path d="M12 3 20 6v5c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z"/><path d="m9 12 2 2 4-4"/></svg>; }
export function CameraIcon(props: SVGProps<SVGSVGElement>) { return <svg {...base} {...props}><path d="M4 8h4l2-3h4l2 3h4v11H4z"/><circle cx="12" cy="13" r="3"/></svg>; }
export function FileIcon(props: SVGProps<SVGSVGElement>) { return <svg {...base} {...props}><path d="M6 2h8l4 4v16H6z"/><path d="M14 2v5h5M9 13h6M9 17h6"/></svg>; }
export function AlertIcon(props: SVGProps<SVGSVGElement>) { return <svg {...base} {...props}><path d="M12 3 2.5 20h19z"/><path d="M12 9v5M12 17h.01"/></svg>; }
export function HomeIcon(props: SVGProps<SVGSVGElement>) { return <svg {...base} {...props}><path d="m3 11 9-8 9 8"/><path d="M5 10v11h14V10M9 21v-7h6v7"/></svg>; }
export function ShopIcon(props: SVGProps<SVGSVGElement>) { return <svg {...base} {...props}><path d="M4 9h16l-1 12H5z"/><path d="M7 9a5 5 0 0 1 10 0"/></svg>; }
