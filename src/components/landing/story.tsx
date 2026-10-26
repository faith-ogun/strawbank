"use client";

// The hero and the day's moments share one 3D stand. On a wide screen the
// stand sits beside the text and stays put while the moments scroll past; on
// a phone it sticks to the top and the moments scroll underneath. Whichever
// moment crosses the reading line is the one the stand shows.

import dynamic from "next/dynamic";
import Image from "next/image";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { MOMENTS } from "./moments";

const StandScene = dynamic(() => import("./stand-scene"), { ssr: false });

export function Story({ hero, chapters }: { hero: ReactNode; chapters: ReactNode[] }) {
  const [step, setStep] = useState(0);
  const blocks = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    const watch = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setStep(Number((entry.target as HTMLElement).dataset.step));
        }
      },
      { rootMargin: "-62% 0px -37% 0px" },
    );
    for (const el of blocks.current) if (el) watch.observe(el);
    return () => watch.disconnect();
  }, []);

  const moment = MOMENTS[step];

  return (
    <div className="mx-auto grid max-w-[1240px] grid-cols-1 gap-x-12 px-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)] lg:px-8">
      <section
        ref={(el) => {
          blocks.current[0] = el;
        }}
        data-step={0}
        className="flex flex-col justify-center pb-10 pt-12 lg:col-start-1 lg:row-start-1 lg:min-h-[calc(100svh-64px)] lg:pb-24 lg:pt-10"
      >
        {hero}
      </section>

      <div className="sticky top-16 z-10 -mx-4 h-[44svh] self-start bg-white px-4 pb-3 pt-2 sm:-mx-6 sm:px-6 lg:top-[88px] lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:mx-0 lg:h-[calc(100svh-112px)] lg:bg-transparent lg:p-0">
        <div className="scene-frame relative h-full overflow-hidden rounded-[22px] border border-line shadow-card lg:rounded-[28px]" style={{ background: "linear-gradient(180deg, #9fd1ef 0%, #f6efdc 78%)" }}>
          <div className="scene-poster absolute inset-0 grid place-items-center">
            <Image src="/brand/strawbank-mark.png" alt="" width={120} height={136} className="opacity-25" priority />
          </div>
          <StandScene step={step} />

          {moment.photo && <div key={step} className="photo-flash pointer-events-none absolute inset-0 bg-white motion-reduce:hidden" />}

          <div
            aria-hidden
            className={`pointer-events-none absolute inset-5 transition-opacity duration-500 lg:inset-8 ${moment.photo ? "opacity-100" : "opacity-0"}`}
          >
            {["left-0 top-0 border-l-2 border-t-2", "right-0 top-0 border-r-2 border-t-2", "bottom-0 left-0 border-b-2 border-l-2", "bottom-0 right-0 border-b-2 border-r-2"].map((c) => (
              <span key={c} className={`absolute h-7 w-7 border-white/90 ${c}`} />
            ))}
            <span className="eyebrow absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-ink/70 px-3 py-1 text-white">
              Photo · {moment.photo ?? ""}
            </span>
          </div>

          <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-white/95 py-1 pl-1.5 pr-3 shadow-sm lg:left-5 lg:top-5">
            <span className="rounded-full bg-ink px-2 py-0.5 font-mono text-[0.6875rem] font-medium text-white">{moment.clock}</span>
            <span className="text-xs font-semibold text-ink">{moment.label}</span>
          </div>
          <p className="sr-only" aria-live="polite">
            {moment.clock}, {moment.label}
          </p>
        </div>
      </div>

      <div className="lg:col-start-1 lg:row-start-2">
        {chapters.map((chapter, i) => (
          <section
            key={MOMENTS[i + 1].id}
            id={MOMENTS[i + 1].id}
            ref={(el) => {
              blocks.current[i + 1] = el;
            }}
            data-step={i + 1}
            className="scroll-mt-[calc(44svh+80px)] border-t border-line py-14 lg:flex lg:min-h-[88svh] lg:scroll-mt-24 lg:flex-col lg:justify-center lg:border-0 lg:py-20"
          >
            {chapter}
          </section>
        ))}
      </div>
    </div>
  );
}
