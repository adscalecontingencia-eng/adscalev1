import React from "react";
import adLogoAsset from "@/assets/ad-logo.png.asset.json";

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

  if (variant === "mark") {
    return (
      <img
        src={adLogoAsset.url}
        alt="AD SCALE"
        height={size}
        style={{ height: size, width: "auto", ...glowStyle }}
        className={`object-contain select-none notranslate ${className}`}
        draggable={false}
        translate="no"
      />
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
      <img
        src={adLogoAsset.url}
        alt=""
        aria-hidden="true"
        loading="eager"
        decoding="sync"
        style={{ height: size, width: size * 1.4, minWidth: size * 1.2 }}
        className="object-contain shrink-0 select-none"
        draggable={false}
      />
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
