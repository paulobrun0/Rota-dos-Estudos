import React, { useMemo, useState } from "react";
import { colors } from "../styles/colors.js";
import { buildStatsSeries, defaultRangeFor, GRANULARITIES } from "../lib/statsRange.js";
import { todayISO } from "../lib/date.js";

const GRANULARITY_LABELS = { dia: "diário", semana: "semanal", mes: "mensal", ano: "anual", personalizado: "personalizado" };
const TRACK_HEIGHT = 110;

// Only label every Nth bar once there are more than a handful — otherwise
// the x-axis text collides into an unreadable smear.
function labelStride(count) {
  if (count <= 12) return 1;
  return Math.ceil(count / 10);
}

function BarColumn({ bucket, max, color, valueKey, hovered, onEnter, onLeave, showLabel, formatValue }) {
  const value = bucket[valueKey];
  const heightPct = max > 0 ? Math.max((value / max) * 100, value > 0 ? 3 : 0) : 0;
  return (
    <div
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      title={formatValue(bucket)}
      style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: "1 0 auto", minWidth: 14, cursor: "default" }}
    >
      <div style={{ position: "relative", width: "100%", height: TRACK_HEIGHT, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
        {hovered && (
          <div
            className="mono"
            style={{
              position: "absolute", bottom: `calc(${heightPct}% + 6px)`, left: "50%", transform: "translateX(-50%)",
              background: colors.surface2, border: `1px solid ${colors.border}`, borderRadius: 6, padding: "4px 7px",
              fontSize: 11, color: colors.text, whiteSpace: "nowrap", zIndex: 1, pointerEvents: "none",
            }}
          >
            {formatValue(bucket)}
          </div>
        )}
        <div
          style={{
            width: "60%", maxWidth: 22, height: `${heightPct}%`, minHeight: value > 0 ? 2 : 0,
            background: hovered ? color.hover : color.base, borderRadius: "3px 3px 0 0", transition: "background 0.1s",
          }}
        />
      </div>
      <div style={{ fontSize: 9.5, color: colors.textFaint, marginTop: 4, whiteSpace: "nowrap" }}>
        {showLabel ? bucket.label : ""}
      </div>
    </div>
  );
}

function ChartBlock({ title, series, valueKey, colorFor, emptyHint, formatValue }) {
  const [hoveredKey, setHoveredKey] = useState(null);
  const max = Math.max(1, ...series.map((b) => b[valueKey]));
  const stride = labelStride(series.length);
  const hasAny = series.some((b) => b[valueKey] > 0);

  return (
    <div style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 12, padding: "14px 16px" }}>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: colors.textMuted, marginBottom: hasAny ? 10 : 4 }}>{title}</div>
      {!hasAny && <div style={{ fontSize: 12, color: colors.textFaint }}>{emptyHint}</div>}
      {hasAny && (
        <div style={{ display: "flex", gap: 2, overflowX: "auto", paddingBottom: 2 }}>
          {series.map((bucket, i) => (
            <BarColumn
              key={bucket.key}
              bucket={bucket}
              max={max}
              valueKey={valueKey}
              color={colorFor(bucket)}
              hovered={hoveredKey === bucket.key}
              onEnter={() => setHoveredKey(bucket.key)}
              onLeave={() => setHoveredKey(null)}
              showLabel={i % stride === 0 || i === series.length - 1}
              formatValue={formatValue}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function StatsChart({ activity, questionActivity }) {
  const [granularity, setGranularity] = useState("dia");
  const [customStart, setCustomStart] = useState(() => defaultRangeFor("dia").start);
  const [customEnd, setCustomEnd] = useState(() => todayISO());

  const range = granularity === "personalizado" ? { start: customStart, end: customEnd } : defaultRangeFor(granularity);

  const series = useMemo(
    () => buildStatsSeries(activity || {}, questionActivity || {}, { granularity, start: range.start, end: range.end }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activity, questionActivity, granularity, range.start, range.end],
  );

  const totalCards = series.reduce((a, b) => a + b.cards, 0);
  const totalQuestions = series.reduce((a, b) => a + b.questionsTotal, 0);
  const totalCorrect = series.reduce((a, b) => a + b.questionsCorrect, 0);
  const overallAccuracy = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : null;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        {GRANULARITIES.map((g) => (
          <button
            key={g}
            onClick={() => setGranularity(g)}
            style={{
              background: granularity === g ? colors.tealSoft : "transparent", border: `1px solid ${granularity === g ? colors.teal : colors.border}`,
              borderRadius: 20, padding: "5px 12px", fontSize: 12, color: granularity === g ? colors.teal : colors.textMuted, flexShrink: 0,
            }}
          >
            {GRANULARITY_LABELS[g]}
          </button>
        ))}
        {granularity === "personalizado" && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 4 }}>
            <input
              type="date" value={customStart} max={customEnd} onChange={(e) => setCustomStart(e.target.value)}
              style={{ background: colors.surface2, border: `1px solid ${colors.border}`, borderRadius: 6, padding: "4px 6px", fontSize: 12, color: colors.text }}
            />
            <span style={{ fontSize: 12, color: colors.textFaint }}>até</span>
            <input
              type="date" value={customEnd} min={customStart} max={todayISO()} onChange={(e) => setCustomEnd(e.target.value)}
              style={{ background: colors.surface2, border: `1px solid ${colors.border}`, borderRadius: 6, padding: "4px 6px", fontSize: 12, color: colors.text }}
            />
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 16, marginBottom: 12, fontSize: 12, color: colors.textFaint }}>
        <span><b style={{ color: colors.text }}>{totalCards}</b> cards no período</span>
        <span><b style={{ color: colors.text }}>{totalQuestions}</b> questões</span>
        {overallAccuracy !== null && (
          <span>
            <b style={{ color: overallAccuracy >= 70 ? colors.teal : colors.red }}>{overallAccuracy}%</b> de acerto
          </span>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <ChartBlock
          title="assuntos estudados"
          series={series}
          valueKey="cards"
          colorFor={() => ({ base: colors.teal, hover: colors.teal })}
          emptyHint="nenhum assunto estudado nesse período."
          formatValue={(b) => `${b.label}: ${b.cards} card${b.cards !== 1 ? "s" : ""}`}
        />
        <ChartBlock
          title="questões praticadas"
          series={series}
          valueKey="questionsTotal"
          colorFor={(b) => (b.accuracyPct === null || b.accuracyPct >= 70 ? { base: colors.teal, hover: colors.teal } : { base: colors.red, hover: colors.red })}
          emptyHint="nenhuma questão praticada nesse período."
          formatValue={(b) => `${b.label}: ${b.questionsCorrect}/${b.questionsTotal}${b.accuracyPct !== null ? ` · ${b.accuracyPct}%` : ""}`}
        />
      </div>
      {totalQuestions > 0 && (
        <div style={{ fontSize: 10.5, color: colors.textFaint, marginTop: 6 }}>
          barra verde: ≥70% de acerto no período · vermelha: abaixo de 70%
        </div>
      )}
    </div>
  );
}
