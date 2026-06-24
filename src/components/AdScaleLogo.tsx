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

  // Full wordmark: large AD symbol with SCALE baseline-aligned to its bottom.
  const symbolHeight = size;
  const symbolWidth = size * 1.4;
  return (
    <span
      className={`inline-flex items-end notranslate leading-none ${className}`}
      style={{ height: size, gap: Math.max(4, size * 0.12), ...glowStyle }}
      translate="no"
      aria-label="AD SCALE"
    >
      <img
        src={adLogoAsset.url}
        alt=""
        aria-hidden="true"
        loading="eager"
        decoding="sync"
        style={{
          height: symbolHeight,
          width: symbolWidth,
          minWidth: symbolWidth,
        }}
        className="object-contain shrink-0 select-none block"
        draggable={false}
      />
      <span
        className="font-display font-black tracking-tight text-foreground leading-none"
        style={{
          fontSize: size * 0.55,
          paddingBottom: size * 0.08,
        }}
      >
        SCALE
      </span>
    </span>
  );

};

export default AdScaleLogo;
