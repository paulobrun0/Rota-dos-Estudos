import React from "react";
import { Check, Flame, Trophy } from "lucide-react";
import { colors } from "../styles/colors.js";
import { fromISO } from "../lib/date.js";
import { buildHeatmapWeeks, computeStreaks, heatLevel } from "../lib/streaks.js";
import { computeMateriaStats, computeTopicStats } from "../lib/materiaStats.js";
import { SectionLabel } from "../components/SectionLabel.jsx";

const HEAT_COLORS = [colors.surface2, colors.heat1, colors.heat2, colors.amber];
const MESES_ABR = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function ProgressoView({ activity, activeConcurso }) {
  const materiaStats = computeMateriaStats(activeConcurso);
  const topicStats = computeTopicStats(activeConcurso);
  const { current, longest } = computeStreaks(activity);
  const weeks = buildHeatmapWeeks(activity);
  const totalDias = Object.keys(activity).filter((k) => activity[k] > 0).length;
  const totalCards = Object.values(activity).reduce((a, b) => a + b, 0);

  // Month labels above the columns where a new month starts.
  const monthLabels = weeks.map((week) => {
    const first = week[0];
    const d = fromISO(first.iso);
    return d.getDate() <= 7 ? MESES_ABR[d.getMonth()] : "";
  });

  return (
    <div>
      <div className="sg" style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>progresso</div>
      <div style={{ fontSize: 13.5, color: colors.textMuted, marginBottom: 20 }}>
        sua constância ao longo do tempo, somando todos os concursos.
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 26 }}>
        <StatCard icon={<Flame size={16} color={colors.amber} />} label="sequência atual" value={`${current} dia${current !== 1 ? "s" : ""}`} />
        <StatCard icon={<Trophy size={16} color={colors.amber} />} label="recorde" value={`${longest} dia${longest !== 1 ? "s" : ""}`} />
        <StatCard icon={<Check size={16} color={colors.amber} />} label="cards concluídos" value={`${totalCards}`} sub={`em ${totalDias} dia${totalDias !== 1 ? "s" : ""}`} />
      </div>

      <SectionLabel text="últimas 18 semanas" />
      <div style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 16, overflowX: "auto" }}>
        <div style={{ display: "inline-flex", flexDirection: "column", gap: 4 }}>
          <div style={{ display: "flex", gap: 3 }}>
            {monthLabels.map((label, i) => (
              <div key={i} style={{ width: 13, fontSize: 10, color: colors.textFaint }}>{label}</div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 3 }}>
            {weeks.map((week, wi) => (
              <div key={wi} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {week.map((day) => (
                  <div
                    key={day.iso}
                    title={`${day.iso} · ${day.count} card${day.count !== 1 ? "s" : ""}`}
                    style={{
                      width: 13, height: 13, borderRadius: 3,
                      background: day.future ? "transparent" : HEAT_COLORS[heatLevel(day.count)],
                      border: day.future ? `1px dashed ${colors.borderSoft}` : "none",
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
            <span style={{ fontSize: 11, color: colors.textFaint }}>menos</span>
            {HEAT_COLORS.map((c, i) => (
              <div key={i} style={{ width: 11, height: 11, borderRadius: 3, background: c }} />
            ))}
            <span style={{ fontSize: 11, color: colors.textFaint }}>mais</span>
          </div>
        </div>
      </div>

      {activeConcurso && materiaStats.length > 0 && (
        <>
          <SectionLabel text={`desempenho por matéria · ${activeConcurso.name}`} />
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 26 }}>
            {materiaStats.map((m) => (
              <MateriaStatRow key={m.id} stat={m} />
            ))}
          </div>
        </>
      )}

      {activeConcurso && topicStats.length > 0 && (
        <>
          <SectionLabel text="desempenho por assunto · do mais fraco pro mais forte" />
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {topicStats.map((t) => (
              <TopicStatRow key={t.id} stat={t} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function MateriaStatRow({ stat }) {
  const { name, color, total, done, pct, novoCount, revisaoCount, questionsTotal, questionsCorrect, accuracyPct } = stat;
  return (
    <div style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderLeft: `3px solid ${color}`, borderRadius: 10, padding: "12px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
        <div className="sg" style={{ fontSize: 14, fontWeight: 700, color }}>{name}</div>
        <div className="mono" style={{ fontSize: 12.5, color: colors.textMuted, flexShrink: 0 }}>{done}/{total} · {pct}%</div>
      </div>
      <div style={{ height: 6, background: colors.borderSoft, borderRadius: 3, marginBottom: 8 }}>
        <div style={{ height: 6, width: `${pct}%`, background: color, borderRadius: 3 }} />
      </div>
      <div style={{ fontSize: 11.5, color: colors.textFaint }}>
        {novoCount} assunto{novoCount !== 1 ? "s" : ""} novo{novoCount !== 1 ? "s" : ""} concluído{novoCount !== 1 ? "s" : ""} · {revisaoCount} revisão{revisaoCount !== 1 ? "ões" : ""} de ciclo
      </div>
      {accuracyPct !== null && (
        <div style={{ fontSize: 11.5, color: accuracyPct >= 70 ? colors.teal : colors.red, marginTop: 4 }}>
          {questionsCorrect}/{questionsTotal} questões certas · {accuracyPct}% de acerto
        </div>
      )}
    </div>
  );
}

function TopicStatRow({ stat }) {
  const { name, materiaName, materiaColor, total, correct, accuracyPct } = stat;
  const good = accuracyPct >= 70;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, background: colors.surface, border: `1px solid ${colors.border}`, borderLeft: `3px solid ${materiaColor}`, borderRadius: 8, padding: "9px 14px" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, color: colors.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</div>
        <div style={{ fontSize: 11, color: colors.textFaint, marginTop: 1 }}>{materiaName}</div>
      </div>
      <div className="mono" style={{ fontSize: 12, color: colors.textMuted, flexShrink: 0 }}>{correct}/{total}</div>
      <div
        className="mono"
        style={{
          fontSize: 12.5, fontWeight: 700, flexShrink: 0, width: 48, textAlign: "right",
          color: good ? colors.teal : colors.red,
        }}
      >
        {accuracyPct}%
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, sub }) {
  return (
    <div style={{ minWidth: 0, background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 12, padding: "14px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>{icon}<span style={{ fontSize: 12, color: colors.textMuted }}>{label}</span></div>
      <div className="sg" style={{ fontSize: 20, fontWeight: 700 }}>{value}</div>
      {sub && <div style={{ fontSize: 11.5, color: colors.textFaint, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}
