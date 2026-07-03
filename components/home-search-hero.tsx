"use client";

import { useEffect, useState } from "react";
import { LookupForm } from "@/components/lookup-form";

const slides = [
  {
    image: "https://unsplash.com/photos/QvEXI1xquRY/download?force=true&w=1800",
    credit: "Cordless drill · Rob Dean / Unsplash",
  },
  {
    image: "https://unsplash.com/photos/8DQz9z99GjU/download?force=true&w=1800",
    credit: "Angle grinder · Spencer Davis / Unsplash",
  },
  {
    image: "https://unsplash.com/photos/aQQgXiYJ4kU/download?force=true&w=1800",
    credit: "Industrial generator · Kenny / Unsplash",
  },
];

export function HomeSearchHero() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActive((value) => (value + 1) % slides.length);
    }, 10000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="homeSearchHero" role="group" aria-label="Tool serial number check">
      <div className="homeHeroSlides" aria-hidden="true">
        {slides.map((slide, index) => (
          <div
            key={slide.image}
            className={`homeHeroSlide${index === active ? " active" : ""}`}
            style={{ backgroundImage: `url("${slide.image}")` }}
          />
        ))}
      </div>
      <div className="homeSearchHeroShade" aria-hidden="true" />
      <div className="homeSearchHeroContent">
        <div className="homeSearchIntro">
          <strong>Check the serial before you pay.</strong>
          <span>See whether an item has a ToolTrack record or theft report.</span>
        </div>
        <LookupForm />
      </div>
      <small className="homePhotoCredit">{slides[active].credit}</small>
      <div className="homeHeroDots" aria-hidden="true">
        {slides.map((_, index) => <span key={index} className={index === active ? "active" : ""} />)}
      </div>
    </div>
  );
}
