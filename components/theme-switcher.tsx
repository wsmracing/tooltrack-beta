"use client";

import { useEffect, useRef, useState } from "react";

type ThemeName = "red" | "navy" | "green" | "orange";

const themes: Array<{ id: ThemeName; label: string; colour: string }> = [
  { id: "red", label: "ToolTrack Red", colour: "#d71920" },
  { id: "navy", label: "Workshop Navy", colour: "#184c7a" },
  { id: "green", label: "Trade Green", colour: "#24734a" },
  { id: "orange", label: "Safety Orange", colour: "#d95f0b" },
];

export function ThemeSwitcher() {
  const [theme, setTheme] = useState<ThemeName>("red");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem("tooltrack-theme") as ThemeName | null;
    const initial = themes.some((item) => item.id === saved) ? saved! : "red";
    setTheme(initial);
    document.documentElement.dataset.theme = initial;
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | TouchEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close, { passive: true });
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("touchstart", close);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  function choose(next: ThemeName) {
    setTheme(next);
    document.documentElement.dataset.theme = next;
    window.localStorage.setItem("tooltrack-theme", next);
    setOpen(false);
  }

  const active = themes.find((item) => item.id === theme) ?? themes[0];

  return <div className="themeSwitcher" ref={wrapRef}>
    <button
      type="button"
      className="themeButton"
      aria-label="Choose website colour"
      aria-haspopup="menu"
      aria-expanded={open}
      onClick={() => setOpen((value) => !value)}
    >
      <span className="themeButtonDot" style={{ background: active.colour }} />
      <span className="themeButtonLabel">Style</span>
    </button>
    {open && <div className="themeDropdown" role="menu" aria-label="Website colour options">
      <strong>Choose a style</strong>
      {themes.map((item) => <button
        key={item.id}
        type="button"
        role="menuitemradio"
        aria-checked={theme === item.id}
        className={theme === item.id ? "active" : ""}
        onClick={() => choose(item.id)}
      >
        <span className="themeSwatch" style={{ background: item.colour }} />
        <span>{item.label}</span>
        {theme === item.id && <span className="themeTick" aria-hidden="true">✓</span>}
      </button>)}
    </div>}
  </div>;
}
