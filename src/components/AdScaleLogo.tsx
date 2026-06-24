import React from "react";

type Props = {
  /** Height in px. Width auto-scales. */
  size?: number;
  className?: string;
  withGlow?: boolean;
  /** "full" = AD symbol + SCALE wordmark · "mark" = AD symbol only */
  variant?: "full" | "mark";
};

/**
 * AD SCALE — official logo.
 * AD blue symbol + SCALE wordmark, sized by `size` (height in px).
 */
const AdScaleLogo: React.FC<Props> = ({
  size = 36,
  className = "",
  withGlow = false,
  variant = "full",
}) => {
  const glowStyle = withGlow
    ? { filter: "drop-shadow(0 0 10px hsl(var(--primary) / 0.35))" }
    : undefined;

  const markWidth = size * 1.4;
  const mark = (
    <svg
      viewBox="0 0 140 100"
      width={markWidth}
      height={size}
      className="shrink-0 select-none text-primary"
      style={{ width: markWidth, minWidth: markWidth, height: size }}
      role={variant === "mark" ? "img" : undefined}
      aria-label={variant === "mark" ? "AD SCALE" : undefined}
      aria-hidden={variant === "mark" ? undefined : "true"}
      focusable="false"
    >
      <path
        d="M8 91 L46 9 L84 91"
        fill="none"
        stroke="currentColor"
        strokeWidth="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M36 61 H78 C104 61 122 75 122 91"
        fill="none"
        stroke="currentColor"
        strokeWidth="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M69 34 H83 C112 34 132 55 132 76 C132 91 121 97 108 97 C96 97 84 91 76 82 L52 55"
        fill="none"
        stroke="currentColor"
        strokeWidth="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  if (variant === "mark") {
    return (
      <span
        className={`inline-flex items-center notranslate leading-none ${className}`}
        style={{ height: size, ...glowStyle }}
        translate="no"
      >
        {mark}
      </span>
    );
  }

  // Full wordmark: AD symbol + SCALE text, scaled together off `size` (height).
  return (
    <span
      className={`inline-flex items-center notranslate leading-none ${className}`}
      style={{ height: size, gap: Math.max(2, size * 0.05), ...glowStyle }}
      translate="no"
      aria-label="AD SCALE"
    >
      {mark}
      <span
        className="font-display font-black tracking-tight text-foreground leading-none"
        style={{
          fontSize: size * 0.78,
          transform: `translateY(${size * 0.18}px)`,
        }}
      >
        SCALE
      </span>
    </span>
  );
};

export default AdScaleLogo;
