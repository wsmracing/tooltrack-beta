"use client";

import { useEffect, useState } from "react";

type Appearance = "light" | "dark";

function applyAppearance(appearance: Appearance) {
  document.documentElement.dataset.appearance = appearance;
  document.documentElement.style.colorScheme = appearance;
}

export function ThemeSwitcher() {
  const [appearance, setAppearance] = useState<Appearance>("light");

  useEffect(() => {
    const saved = window.localStorage.getItem("tooltrack-appearance");
    const preferred: Appearance = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    const initial: Appearance = saved === "dark" || saved === "light" ? saved : preferred;
    setAppearance(initial);
    applyAppearance(initial);
  }, []);

  function toggleAppearance() {
    const next: Appearance = appearance === "dark" ? "light" : "dark";
    setAppearance(next);
    applyAppearance(next);
    window.localStorage.setItem("tooltrack-appearance", next);
  }

  const nextLabel = appearance === "dark" ? "Switch to light mode" : "Switch to dark mode";

  return (
    <button
      type="button"
      className="appearanceToggle"
      aria-label={nextLabel}
      title={nextLabel}
      onClick={toggleAppearance}
    >
      {appearance === "dark" ? (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M21 12.8A8.5 8.5 0 1 1 11.2 3 6.8 6.8 0 0 0 21 12.8Z" />
        </svg>
      )}
      <span className="appearanceToggleLabel">{appearance === "dark" ? "Light" : "Dark"}</span>
    </button>
  );
}
