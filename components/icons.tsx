import type { SVGProps } from "react";

const base = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export function SearchIcon(props: SVGProps<SVGSVGElement>) { return <svg {...base} {...props}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>; }
export function ToolboxIcon(props: SVGProps<SVGSVGElement>) { return <svg {...base} {...props}><path d="M4 8h16v11H4z"/><path d="M9 8V5h6v3M4 12h16M10 12v2h4v-2"/></svg>; }
export function PlusIcon(props: SVGProps<SVGSVGElement>) { return <svg {...base} {...props}><path d="M12 5v14M5 12h14"/></svg>; }
export function UserIcon(props: SVGProps<SVGSVGElement>) { return <svg {...base} {...props}><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>; }
export function UsersIcon(props: SVGProps<SVGSVGElement>) { return <svg {...base} {...props}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>; }
export function ShieldIcon(props: SVGProps<SVGSVGElement>) { return <svg {...base} {...props}><path d="M12 3 20 6v5c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z"/><path d="m9 12 2 2 4-4"/></svg>; }
export function CameraIcon(props: SVGProps<SVGSVGElement>) { return <svg {...base} {...props}><path d="M4 8h4l2-3h4l2 3h4v11H4z"/><circle cx="12" cy="13" r="3"/></svg>; }
export function FileIcon(props: SVGProps<SVGSVGElement>) { return <svg {...base} {...props}><path d="M6 2h8l4 4v16H6z"/><path d="M14 2v5h5M9 13h6M9 17h6"/></svg>; }
export function AlertIcon(props: SVGProps<SVGSVGElement>) { return <svg {...base} {...props}><path d="M12 3 2.5 20h19z"/><path d="M12 9v5M12 17h.01"/></svg>; }
export function HomeIcon(props: SVGProps<SVGSVGElement>) { return <svg {...base} {...props}><path d="m3 11 9-8 9 8"/><path d="M5 10v11h14V10M9 21v-7h6v7"/></svg>; }
export function ShopIcon(props: SVGProps<SVGSVGElement>) { return <svg {...base} {...props}><path d="M4 9h16l-1 12H5z"/><path d="M7 9a5 5 0 0 1 10 0"/></svg>; }
export function BarcodeIcon(props: SVGProps<SVGSVGElement>) { return <svg {...base} {...props}><path d="M3 5v4M3 15v4M21 5v4M21 15v4M7 6v12M10 6v12M14 6v12M17 6v12"/></svg>; }
export function EditIcon(props: SVGProps<SVGSVGElement>) { return <svg {...base} {...props}><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>; }
export function UploadIcon(props: SVGProps<SVGSVGElement>) { return <svg {...base} {...props}><path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 21h14"/></svg>; }
export function DownloadIcon(props: SVGProps<SVGSVGElement>) { return <svg {...base} {...props}><path d="M12 3v12M7 10l5 5 5-5"/><path d="M5 21h14"/></svg>; }
export function MapPinIcon(props: SVGProps<SVGSVGElement>) { return <svg {...base} {...props}><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>; }
export function BuildingIcon(props: SVGProps<SVGSVGElement>) { return <svg {...base} {...props}><path d="M3 21h18M6 21V3h12v18M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2"/></svg>; }
export function LayersIcon(props: SVGProps<SVGSVGElement>) { return <svg {...base} {...props}><path d="m12 2 9 5-9 5-9-5z"/><path d="m3 12 9 5 9-5M3 17l9 5 9-5"/></svg>; }
export function TransferIcon(props: SVGProps<SVGSVGElement>) { return <svg {...base} {...props}><path d="M17 3l4 4-4 4"/><path d="M3 7h18M7 21l-4-4 4-4"/><path d="M21 17H3"/></svg>; }
export function CheckIcon(props: SVGProps<SVGSVGElement>) { return <svg {...base} {...props}><path d="m5 12 4 4L19 6"/></svg>; }
export function MailIcon(props: SVGProps<SVGSVGElement>) { return <svg {...base} {...props}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>; }
export function MenuIcon(props: SVGProps<SVGSVGElement>) { return <svg {...base} {...props}><path d="M4 6h16M4 12h16M4 18h16"/></svg>; }
export function CloseIcon(props: SVGProps<SVGSVGElement>) { return <svg {...base} {...props}><path d="m6 6 12 12M18 6 6 18"/></svg>; }
export function MoreIcon(props: SVGProps<SVGSVGElement>) { return <svg {...base} {...props}><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none"/></svg>; }
export function TagIcon(props: SVGProps<SVGSVGElement>) { return <svg {...base} {...props}><path d="M20 13 13 20 4 11V4h7z"/><circle cx="8.5" cy="8.5" r="1.5"/></svg>; }
export function CopyIcon(props: SVGProps<SVGSVGElement>) { return <svg {...base} {...props}><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>; }
