"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

// Scroll-scrubbing (DESAIN §2c update 2): progress video terikat posisi
// scroll di dalam wrapper [data-hero]. Kalau user minta reduced-motion,
// <video> tidak dirender sama sekali supaya 4,7MB-nya tidak ikut terunduh;
// layout kolaps ke hero statis via CSS motion-safe di hero-section.
export function HeroVideo() {
  const reduced = useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => true,
  );
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const wrapper = video.closest<HTMLElement>("[data-hero]");
    if (!wrapper) return;

    let target = 0;
    let current = 0;
    let raf = 0;

    const onScroll = () => {
      const rect = wrapper.getBoundingClientRect();
      const scrollable = rect.height - window.innerHeight;
      const progress =
        scrollable > 0 ? Math.min(Math.max(-rect.top / scrollable, 0), 1) : 0;
      target = progress * (video.duration || 0);
      // Di tepi hero (masuk/keluar) kehalusan tidak terlihat — snap saja.
      // Tanpa ini lerp masih nge-seek 60x/detik ±1 detik setelah sticky
      // lepas, tepat saat konten bawah mulai bergerak → scroll tersendat.
      if (progress === 0 || progress === 1) current = target;
    };

    // currentTime dikejar bertahap (lerp), bukan di-set langsung —
    // scroll wheel melompat-lompat, lerp yang bikin gerakannya halus.
    const tick = () => {
      current += (target - current) * 0.15;
      if (Math.abs(target - current) <= 0.02) current = target;
      // Bandingkan dengan posisi video sungguhan, bukan diff lerp —
      // supaya frame terakhir tetap di-seek sekali setelah snap, lalu diam.
      if (Math.abs(current - video.currentTime) > 0.02 && !video.seeking) {
        video.currentTime = current;
      }
      raf = requestAnimationFrame(tick);
    };

    // iOS Safari kadang tidak me-render frame hasil seek sebelum video
    // pernah "diaktifkan" — play+pause sekali menyalakan pipeline decode.
    // onScroll diulang di sini karena duration baru terisi setelah metadata.
    const prime = () => {
      video.play().then(() => video.pause()).catch(() => {});
      onScroll();
    };
    if (video.readyState >= 1) prime();
    else video.addEventListener("loadedmetadata", prime, { once: true });

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    onScroll();
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      video.removeEventListener("loadedmetadata", prime);
    };
  }, [reduced]);

  if (reduced) return null;

  return (
    <video
      ref={ref}
      muted
      playsInline
      preload="auto"
      src="/futsal-scrub.mp4"
      poster="/hero-poster.jpg"
      aria-hidden="true"
      className="absolute inset-0 h-full w-full object-cover"
    />
  );
}
