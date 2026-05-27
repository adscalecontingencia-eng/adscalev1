import React from "react";
import { motion } from "framer-motion";

/**
 * AD SCALE animated background.
 * Dark canvas with floating neon orbs, animated grid sheen, scanline and
 * subtle particles. Purely decorative — pointer-events disabled.
 */
const AnimatedBackground: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className ?? ""}`}
    >
      {/* Base radial vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.10),transparent_60%)]" />

      {/* Animated grid */}
      <div className="absolute inset-0 grid-texture opacity-40" />
      <motion.div
        className="absolute inset-0 grid-texture opacity-25"
        animate={{ backgroundPositionY: ["0px", "72px"] }}
        transition={{ duration: 14, ease: "linear", repeat: Infinity }}
      />

      {/* Floating neon orbs */}
      <motion.div
        className="absolute -top-32 -left-24 w-[640px] h-[640px] rounded-full bg-primary/[0.10] blur-[120px]"
        animate={{ x: [0, 60, -20, 0], y: [0, 40, -30, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute top-[35%] -right-32 w-[720px] h-[720px] rounded-full bg-primary/[0.07] blur-[140px]"
        animate={{ x: [0, -80, 30, 0], y: [0, -50, 40, 0] }}
        transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-[-15%] left-[20%] w-[560px] h-[560px] rounded-full bg-primary/[0.06] blur-[120px]"
        animate={{ x: [0, 40, -60, 0], y: [0, -30, 20, 0] }}
        transition={{ duration: 30, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Diagonal sheen */}
      <motion.div
        className="absolute -inset-x-1/3 top-0 h-[200vh] bg-gradient-to-b from-transparent via-primary/[0.05] to-transparent rotate-12"
        animate={{ y: ["-30%", "10%", "-30%"] }}
        transition={{ duration: 18, ease: "easeInOut", repeat: Infinity }}
      />

      {/* Particles */}
      {Array.from({ length: 14 }).map((_, i) => {
        const left = (i * 73) % 100;
        const delay = (i % 7) * 0.8;
        const duration = 10 + (i % 5) * 2;
        const size = 2 + (i % 3);
        return (
          <motion.span
            key={i}
            className="absolute rounded-full bg-primary/70 shadow-[0_0_12px_hsl(var(--primary)/0.8)]"
            style={{ left: `${left}%`, width: size, height: size, bottom: -10 }}
            initial={{ y: 0, opacity: 0 }}
            animate={{ y: "-110vh", opacity: [0, 1, 1, 0] }}
            transition={{ duration, delay, repeat: Infinity, ease: "linear" }}
          />
        );
      })}

      {/* Top scanline */}
      <motion.div
        className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent"
        initial={{ top: "-2%" }}
        animate={{ top: ["-2%", "102%"] }}
        transition={{ duration: 9, repeat: Infinity, ease: "linear" }}
      />

      {/* Bottom fade so content stays legible */}
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background to-transparent" />
    </div>
  );
};

export default AnimatedBackground;
