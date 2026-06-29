import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

type Pixel = {
  id: string;
  provider: "meta" | "google_ads" | "google_analytics";
  pixel_id: string;
  extra: Record<string, any> | null;
  enabled: boolean;
};

declare global {
  interface Window {
    fbq?: any;
    _fbq?: any;
    gtag?: any;
    dataLayer?: any[];
    __adscalePixels?: Pixel[];
    __trackConversion?: (p: { value: number; currency?: string; orderId?: string }) => void;
  }
}

function loadScript(src: string, id: string, attrs: Record<string, string> = {}) {
  if (document.getElementById(id)) return;
  const s = document.createElement("script");
  s.id = id;
  s.async = true;
  s.src = src;
  Object.entries(attrs).forEach(([k, v]) => s.setAttribute(k, v));
  document.head.appendChild(s);
}

function injectMetaPixel(pixelId: string) {
  if (window.fbq) {
    try { window.fbq("init", pixelId); } catch { /* ignore */ }
    return;
  }
  // Standard Meta Pixel snippet (without noscript img in head)
  /* eslint-disable */
  (function (f: any, b: any, e: any, v: any) {
    let n: any, t: any, s: any;
    if (f.fbq) return;
    n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
    if (!f._fbq) f._fbq = n;
    n.push = n; n.loaded = !0; n.version = "2.0"; n.queue = [];
    t = b.createElement(e); t.async = !0; t.src = v;
    s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
  })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
  /* eslint-enable */
  window.fbq("init", pixelId);
  window.fbq("track", "PageView");
}

function injectGtag(tagId: string) {
  window.dataLayer = window.dataLayer || [];
  if (!window.gtag) {
    window.gtag = function () { window.dataLayer!.push(arguments); };
    window.gtag("js", new Date());
  }
  loadScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(tagId)}`, `gtag-${tagId}`);
  window.gtag("config", tagId);
}

function buildTracker(pixels: Pixel[]) {
  return (p: { value: number; currency?: string; orderId?: string }) => {
    const currency = p.currency || "BRL";
    const value = Number(p.value || 0);
    pixels.forEach((px) => {
      if (!px.enabled) return;
      try {
        if (px.provider === "meta" && window.fbq) {
          window.fbq("track", "Purchase", { value, currency }, p.orderId ? { eventID: p.orderId } : undefined);
        } else if (px.provider === "google_ads" && window.gtag) {
          const label = (px.extra && (px.extra as any).conversion_label) || "";
          const sendTo = label ? `${px.pixel_id}/${label}` : px.pixel_id;
          window.gtag("event", "conversion", {
            send_to: sendTo,
            value,
            currency,
            transaction_id: p.orderId || "",
          });
        } else if (px.provider === "google_analytics" && window.gtag) {
          window.gtag("event", "purchase", {
            value,
            currency,
            transaction_id: p.orderId || "",
          });
        }
      } catch { /* ignore */ }
    });
  };
}

export default function TrackingLoader() {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("tracking_pixels")
        .select("id,provider,pixel_id,extra,enabled")
        .eq("enabled", true);
      if (cancelled || !data) return;
      const pixels = data as Pixel[];
      window.__adscalePixels = pixels;

      pixels.forEach((px) => {
        if (!px.pixel_id) return;
        if (px.provider === "meta") injectMetaPixel(px.pixel_id);
        else if (px.provider === "google_ads" || px.provider === "google_analytics") injectGtag(px.pixel_id);
      });

      window.__trackConversion = buildTracker(pixels);
    })();
    return () => { cancelled = true; };
  }, []);
  return null;
}
