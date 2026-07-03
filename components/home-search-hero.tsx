"use client";

import { useEffect, useState } from "react";
import { LookupForm } from "@/components/lookup-form";

const slides = [
  {
    image: "https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=1800&q=82",
    credit: "Workshop tools · Unsplash",
  },
  {
    image: "https://images.unsplash.com/photo-1530124566582-a618bc2615dc?auto=format&fit=crop&w=1800&q=82",
    credit: "Professional workshop · Unsplash",
  },
  {
    image: "https://images.unsplash.com/photo-1586864387967-d02ef85d93e8?auto=format&fit=crop&w=1800&q=82",
    credit: "Tools on site · Unsplash",
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
