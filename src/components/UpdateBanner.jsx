import React from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { RefreshCw } from "lucide-react";
import { colors } from "../styles/colors.js";
import { primaryBtnStyle } from "../styles/shared.js";

// Checking every hour is frequent enough that a shipped fix doesn't sit
// unnoticed in an open tab for a whole day, without polling so often it's
// wasteful — this app has no offline mode, so there's no real cost to
// leaning toward "check more" here.
const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

// registerType: "autoUpdate" makes a new service worker take over
// silently in the background, but the page you already have open keeps
// running the OLD JS until an actual reload — there's no such thing as a
// build "just showing up" in a tab that's been open since before it shipped.
// This surfaces that moment instead of leaving it invisible, since a study
// app is exactly the kind of thing people leave open in a pinned tab for days.
export function UpdateBanner() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      setInterval(() => registration.update(), UPDATE_CHECK_INTERVAL_MS);
    },
  });

  if (!needRefresh) return null;

  return (
    <div
      style={{
        position: "fixed", bottom: 20, right: 20, zIndex: 1000, display: "flex", alignItems: "center", gap: 12,
        background: colors.surface, border: `1px solid ${colors.amber}`, borderRadius: 12, padding: "12px 14px 12px 16px",
        boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
      }}
    >
      <span style={{ fontSize: 13, color: colors.text }}>nova versão disponível</span>
      <button onClick={() => updateServiceWorker(true)} style={{ ...primaryBtnStyle, marginTop: 0, padding: "7px 14px", fontSize: 12.5 }}>
        <RefreshCw size={13} /> atualizar
      </button>
    </div>
  );
}
