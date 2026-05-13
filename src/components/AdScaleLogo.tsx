import React from "react";

type Props = {
  size?: number;
  className?: string;
  withGlow?: boolean;
};

/**
 * AD SCALE — minimalist mark.
 * Three ascending bars merging into a sharp upward wedge.
 * Geometry only; color inherits from `currentColor`, so wrap with a text-* class.
 */
const AdScaleLogo: React.FC<Props> = ({ size = 32, className = "", withGlow = true }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={withGlow ? { filter: "drop-shadow(0 0 6px hsl(var(--primary) / 0.45))" } : undefined}
      aria-label="AD SCALE"
      role="img"
    >
      {/* outer rounded frame */}
      <rect
        x="2"
        y="2"
        width="44"
        height="44"
        rx="12"
        stroke="currentColor"
        strokeOpacity="0.35"
        strokeWidth="1.5"
      />
      {/* ascending bars */}
      <rect x="11" y="28" width="5" height="9" rx="1.2" fill="currentColor" fillOpacity="0.55" />
      <rect x="19.5" y="22" width="5" height="15" rx="1.2" fill="currentColor" fillOpacity="0.8" />
      <rect x="28" y="14" width="5" height="23" rx="1.2" fill="currentColor" />
      {/* upward trajectory line */}
      <path
        d="M11 30 L24 22 L37 10"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* arrow tip */}
      <path
        d="M37 10 L37 16 M37 10 L31 10"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
};

export default AdScaleLogo;
