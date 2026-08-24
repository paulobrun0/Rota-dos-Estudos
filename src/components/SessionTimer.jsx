import React, { useEffect } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { colors } from "../styles/colors.js";
import { fmtClock } from "../lib/date.js";
import { iconBtnStyle, primaryBtnStyle, secondaryBtnStyle } from "../styles/shared.js";

export function SessionTimer({ materiaId, totalMinutes, segments, timers, ensureTimer, start, pause, reset }) {
  useEffect(() => {
    ensureTimer(materiaId, totalMinutes, segments);
    // eslint-disable-next-line
  }, [materiaId, totalMinutes, segments]);

  const totalSecondsFallback = Math.max(1, Math.round(totalMinutes * 60));
  const timer = timers[materiaId] || { secondsLeft: totalSecondsFallback, totalSeconds: totalSecondsFallback, running: false };
  const { secondsLeft, totalSeconds, running } = timer;

  const finished = secondsLeft === 0;
  const started = secondsLeft !== totalSeconds;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div className="mono" style={{ fontSize: 20, fontWeight: 600, color: finished ? colors.teal : colors.text, minWidth: 62 }}>
        {fmtClock(secondsLeft)}
      </div>
      {!finished && !running && (
        <button onClick={() => start(materiaId)} style={{ ...primaryBtnStyle, marginTop: 0, padding: "7px 14px" }}>
          <Play size={13} /> {started ? "continuar" : "iniciar"}
        </button>
      )}
      {running && (
        <button onClick={() => pause(materiaId)} style={{ ...secondaryBtnStyle, padding: "7px 14px" }}>
          <Pause size={13} /> pausar
        </button>
      )}
      {started && (
        <button onClick={() => reset(materiaId)} aria-label="reiniciar cronômetro" style={iconBtnStyle}>
          <RotateCcw size={14} />
        </button>
      )}
      {finished && <span style={{ fontSize: 12, color: colors.teal }}>tempo esgotado</span>}
    </div>
  );
}
