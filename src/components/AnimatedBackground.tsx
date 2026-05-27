import React from "react";
import { motion } from "framer-motion";

/**
 * AD SCALE animated background — Safari-optimized.
 * Avoids heavy blur+animation combos that cause jank on WebKit.
 * Orbs are static (GPU paints them once), only lightweight transforms animate.
 */
const AnimatedBackground: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className ?? ""}`}
      style={{ contain: "strict" }}
    >
      {/* Base radial vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.10),transparent_60%)]" />

      {/* Static grid (no animation = no per-frame repaint) */}
      <div className="absolute inset-0 grid-texture opacity-40" />

      {/* Static neon orbs — painted once, promoted to their own layer */}
      <div
        className="absolute -top-32 -left-24 w-[560px] h-[560px] rounded-full bg-primary/[0.10] blur-[100px]"
        style={{ willChange: "transform", transform: "translateZ(0)" }}
      />
      <div
        className="absolute top-[35%] -right-32 w-[620px] h-[620px] rounded-full bg-primary/[0.07] blur-[110px]"
        style={{ willChange: "transform", transform: "translateZ(0)" }}
      />
      <div
        className="absolute bottom-[-15%] left-[20%] w-[480px] h-[480px] rounded-full bg-primary/[0.06] blur-[100px]"
        style={{ willChange: "transform", transform: "translateZ(0)" }}
      />

      {/* Lightweight particles — cheap transform-only animation */}
      {Array.from({ length: 6 }).map((_, i) => {
        const left = (i * 73) % 100;
        const delay = (i % 6) * 1.2;
        const duration = 14 + (i % 4) * 2;
        const size = 2 + (i % 3);
        return (
          <motion.span
            key={i}
            className="absolute rounded-full bg-primary/70"
            style={{
              left: `${left}%`,
              width: size,
              height: size,
              bottom: -10,
              willChange: "transform, opacity",
            }}
            initial={{ y: 0, opacity: 0 }}
            animate={{ y: "-110vh", opacity: [0, 1, 1, 0] }}
            transition={{ duration, delay, repeat: Infinity, ease: "linear" }}
          />
        );
      })}

      {/* Bottom fade so content stays legible */}
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background to-transparent" />
    </div>
  );
};

export default AnimatedBackground;
