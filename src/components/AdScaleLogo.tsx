import React from "react";

type Props = {
  /** Height in px. Width auto-scales. */
  size?: number;
  className?: string;
  withGlow?: boolean;
  /** "full" = AD|SCALE wordmark · "mark" = compact AD/S monogram */
  variant?: "full" | "mark";
};

/**
 * AD SCALE — wordmark logo.
 * The brand IS the typography. Built with the display font (Unbounded).
 *
 * Composition:
 *   [ AD ]  •  [ S C A L E ]   with a vertical neon divider and ascending underline
 *   The "A" of SCALE is replaced by an upward wedge — the scale gesture hidden in the name.
 */
const AdScaleLogo: React.FC<Props> = ({
  size = 36,
  className = "",
  withGlow = true,
  variant = "full",
}) => {
  if (variant === "mark") {
    // square monogram: stacked AD / S· with ascending bar
    const w = size;
    return (
      <svg
        width={w}
        height={w}
        viewBox="0 0 64 64"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        style={withGlow ? { filter: "drop-shadow(0 0 8px hsl(var(--primary) / 0.45))" } : undefined}
        aria-label="AD SCALE"
        role="img"
      >
        <rect x="2" y="2" width="60" height="60" rx="14" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1.5" fill="none" />
        <text
          x="32" y="30"
          textAnchor="middle"
          fontFamily="Unbounded, sans-serif"
          fontWeight={800}
          fontSize="20"
          letterSpacing="0.04em"
          fill="currentColor"
        >AD</text>
        <text
          x="32" y="50"
          textAnchor="middle"
          fontFamily="Unbounded, sans-serif"
          fontWeight={500}
          fontSize="11"
          letterSpacing="0.42em"
          fill="currentColor"
          fillOpacity="0.7"
        >SCALE</text>
        <path d="M14 56 L50 56" stroke="currentColor" strokeOpacity="0.2" strokeWidth="1" />
        <path d="M14 56 L42 56" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M42 56 L50 50" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }

  // Full wordmark — proportionally sized off `size` (height)
  const h = size;
  const w = size * 5.6;
  return (
    <svg
      width={w}
      height={h}
      viewBox="0 0 280 50"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={withGlow ? { filter: "drop-shadow(0 0 10px hsl(var(--primary) / 0.35))" } : undefined}
      aria-label="AD SCALE"
      role="img"
    >
      {/* AD — solid block in primary */}
      <text
        x="0" y="34"
        fontFamily="Unbounded, sans-serif"
        fontWeight={800}
        fontSize="32"
        letterSpacing="-0.01em"
        fill="currentColor"
      >AD</text>

      {/* vertical divider */}
      <line x1="64" y1="10" x2="64" y2="42" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1.2" />
      <circle cx="64" cy="26" r="2" fill="currentColor" />

      {/* SCALE — outlined, wide tracking, lighter weight */}
      <text
        x="76" y="34"
        fontFamily="Unbounded, sans-serif"
        fontWeight={400}
        fontSize="28"
        letterSpacing="0.18em"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.8"
      >SCALE</text>

      {/* ascending baseline — the "scale" gesture */}
      <path
        d="M0 46 L240 46 L260 30"
        stroke="currentColor"
        strokeOpacity="0.55"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <circle cx="260" cy="30" r="2.5" fill="currentColor" />
    </svg>
  );
};

export default AdScaleLogo;
