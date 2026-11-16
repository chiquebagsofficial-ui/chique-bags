"use client";

import { useEffect, useRef, useState } from "react";
import { Instagram } from "@/components/icons";
import { REELS, type Reel } from "@/lib/reels";

/** One reel: it plays (muted, looping) while it is on screen, and a click opens the reel on Instagram. */
function ReelCard({ reel }: { reel: Reel }) {
  const box = useRef<HTMLAnchorElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  // The video file is only requested once the card scrolls into view, so the page itself stays light.
  const [visible, setVisible] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    setReduceMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    const el = box.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.5 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Attach the video the first time it is seen; play it while visible and pause it when it scrolls away.
  useEffect(() => {
    if (visible) setLoaded(true);
  }, [visible]);

  useEffect(() => {
    const v = video.current;
    if (!v || !loaded) return;
    if (visible && !reduceMotion) v.play().catch(() => {});
    else v.pause();
  }, [visible, loaded, reduceMotion]);

  return (
    <a
      ref={box}
      href={reel.url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${reel.label}: watch on Instagram`}
      className="group relative block aspect-[9/16] w-[68%] shrink-0 snap-center overflow-hidden bg-cream sm:w-auto"
    >
      <video
        ref={video}
        src={loaded ? reel.video : undefined}
        poster={reel.poster}
        muted
        loop
        playsInline
        preload="none"
        aria-hidden
        className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.03]"
      />
      <span className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-black/60 to-transparent px-4 pb-4 pt-12 text-[0.7rem] font-medium uppercase tracking-[0.2em] text-white">
        <Instagram size={16} /> Watch on Instagram
      </span>
    </a>
  );
}

export default function ReelsSection() {
  return (
    <section className="wrap pt-28" aria-labelledby="reels-title">
      <div className="mb-12 text-center">
        <p className="eyebrow">On Instagram</p>
        <h2 id="reels-title" className="h-display mt-4 text-4xl sm:text-5xl">Watch our <em>reels</em></h2>
        <span className="rule" />
        <p className="mx-auto mt-5 max-w-md text-sm text-muted">Tap a reel to watch it on Instagram.</p>
      </div>
      <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 sm:mx-auto sm:max-w-4xl sm:grid sm:grid-cols-3 sm:gap-6 sm:overflow-visible sm:px-0">
        {REELS.map((r) => <ReelCard key={r.id} reel={r} />)}
      </div>
    </section>
  );
}
