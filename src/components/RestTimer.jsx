import React from "react";
import { Coffee, Pause, Play, RotateCcw, X } from "../components/Icons.jsx";
import { colors } from "../styles/colors.js";
import { fmtClock } from "../lib/date.js";
import { iconBtnStyle, secondaryBtnStyle } from "../styles/shared.js";

export function RestTimer({ materiaId, timers, start, pause, reset, dismiss }) {
  const timer = timers[materiaId];
  if (!timer) return null;
  const { secondsLeft, totalSeconds, running } = timer;
  const finished = secondsLeft === 0;

  return (
    <div style={{ background: colors.successSoft, border: `1px solid ${colors.success}`, borderRadius: 12, padding: 16, marginBottom: 14, display: "flex", alignItems: "center", gap: 14 }}>
      <Coffee size={20} color={colors.success} style={{ flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="sg" style={{ fontSize: 14, fontWeight: 700, color: colors.success }}>
          {finished ? "descanso concluído" : "descanso"}
        </div>
        <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
          {finished ? "hora de voltar aos estudos." : "matéria concluída — aproveite pra descansar."}
        </div>
      </div>
      <div className="mono" style={{ fontSize: 20, fontWeight: 600, color: colors.success, minWidth: 62 }}>
        {fmtClock(secondsLeft)}
      </div>
      {!finished && !running && (
        <button onClick={() => start(materiaId)} style={{ ...secondaryBtnStyle, padding: "7px 14px", border: `1px solid ${colors.success}`, color: colors.success }}>
          <Play size={13} /> {secondsLeft === totalSeconds ? "iniciar" : "continuar"}
        </button>
      )}
      {running && (
        <button onClick={() => pause(materiaId)} style={{ ...secondaryBtnStyle, padding: "7px 14px" }}>
          <Pause size={13} /> pausar
        </button>
      )}
      {secondsLeft !== totalSeconds && (
        <button onClick={() => reset(materiaId)} aria-label="reiniciar descanso" style={iconBtnStyle}>
          <RotateCcw size={14} />
        </button>
      )}
      <button onClick={() => dismiss(materiaId)} aria-label="dispensar descanso" style={iconBtnStyle}>
        <X size={14} />
      </button>
    </div>
  );
}
