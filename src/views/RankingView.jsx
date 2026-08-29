import React, { useEffect, useMemo, useState } from "react";
import { ListChecks, Trophy } from "lucide-react";
import { colors } from "../styles/colors.js";
import { fetchRanking } from "../api/ranking.js";

const MEDALS = ["🥇", "🥈", "🥉"];
const PERIOD_LABELS = { day: "hoje", week: "7 dias", month: "30 dias" };

function Avatar({ src, name, size = 22 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0, overflow: "hidden", background: colors.surface2,
      display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.4, fontWeight: 700, color: colors.textFaint,
    }}>
      {src ? <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (name || "?").slice(0, 2).toUpperCase()}
    </div>
  );
}

function Bar({ avatar, label, value, max, highlight, suffix }) {
  const pct = max === 0 ? 0 : Math.round((value / max) * 100);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
      <Avatar src={avatar} name={label} size={20} />
      <div style={{ width: 150, fontSize: 12.5, color: highlight ? colors.amber : colors.textMuted, flexShrink: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {label}
      </div>
      <div style={{ flex: 1, background: colors.surface2, borderRadius: 6, height: 10, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, background: highlight ? colors.amber : colors.teal, height: "100%", borderRadius: 6 }} />
      </div>
      <div className="mono" style={{ minWidth: 28, textAlign: "right", fontSize: 12.5, color: colors.textMuted, flexShrink: 0 }}>{value}{suffix || ""}</div>
    </div>
  );
}

export function RankingView({ currentDisplayName, onGoToSettings }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [materia, setMateria] = useState("");
  const [period, setPeriod] = useState("day");

  useEffect(() => {
    fetchRanking().then(setData).catch((e) => setError(e.message));
  }, []);

  const overall = useMemo(() => {
    if (!data) return [];
    return [...data.users].sort((a, b) => b.totalEstudado - a.totalEstudado);
  }, [data]);

  const materiaNames = useMemo(() => {
    if (!data) return [];
    const names = new Map();
    for (const u of data.users) for (const m of u.materias) {
      const key = m.name.toLowerCase();
      if (!names.has(key)) names.set(key, m.name);
    }
    return [...names.values()].sort((a, b) => a.localeCompare(b));
  }, [data]);

  const materiaRanking = useMemo(() => {
    if (!data || !materia) return [];
    const key = materia.toLowerCase();
    return data.users
      .map((u) => {
        const m = u.materias.find((x) => x.name.toLowerCase() === key);
        return { displayName: u.displayName, avatar: u.avatar, estudado: m?.estudado || 0, questionsTotal: m?.questionsTotal || 0, questionsCorrect: m?.questionsCorrect || 0 };
      })
      .filter((u) => u.estudado > 0)
      .sort((a, b) => b.estudado - a.estudado);
  }, [data, materia]);

  useEffect(() => {
    if (!materia && materiaNames.length > 0) setMateria(materiaNames[0]);
  }, [materiaNames, materia]);

  if (error) {
    return <div style={{ color: colors.red, fontSize: 13 }}>{error}</div>;
  }

  const maxEstudado = overall[0]?.totalEstudado || 1;
  const questionRanking = data?.questionPeriods?.[period] || [];
  const maxQuestions = questionRanking[0]?.total || 1;

  return (
    <div>
      <div className="sg" style={{ fontSize: 20, fontWeight: 700, marginBottom: 6, display: "flex", alignItems: "center", gap: 8 }}>
        <Trophy size={18} color={colors.amber} /> ranking
      </div>
      <div style={{ fontSize: 13.5, color: colors.textMuted, marginBottom: 20 }}>
        veja como você está em relação a outras pessoas estudando por aqui.
        {data && !data.isOptedIn && (
          <> você não aparece no ranking dos outros —{" "}
            <button onClick={onGoToSettings} style={{ background: "none", border: "none", padding: 0, color: colors.amber, textDecoration: "underline", cursor: "pointer", font: "inherit" }}>
              mude isso em ajustes
            </button>.
          </>
        )}
      </div>

      {data && overall.length === 0 && (
        <div style={{ color: colors.textFaint, fontSize: 14 }}>ninguém no ranking ainda.</div>
      )}

      {overall.length > 0 && (
        <div style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 18, marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>geral — assuntos estudados</div>
          {overall.map((u, i) => {
            const accuracy = u.questionsTotal > 0 ? Math.round((u.questionsCorrect / u.questionsTotal) * 100) : null;
            const isMe = u.displayName === currentDisplayName;
            return (
              <div key={u.displayName} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: i > 0 ? `1px solid ${colors.border}` : "none" }}>
                <div style={{ width: 20, fontSize: 15, textAlign: "center", flexShrink: 0 }}>{MEDALS[i] || i + 1}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Bar avatar={u.avatar} label={isMe ? `${u.displayName} (você)` : u.displayName} value={u.totalEstudado} max={maxEstudado} highlight={isMe} />
                </div>
                {accuracy !== null && (
                  <div className="mono" style={{ fontSize: 11.5, color: colors.textFaint, width: 60, textAlign: "right", flexShrink: 0 }}>{accuracy}% acerto</div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 18, marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
            <ListChecks size={14} /> questões resolvidas
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {Object.keys(PERIOD_LABELS).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                style={{
                  background: period === p ? colors.amberSoft : "transparent", color: period === p ? colors.amber : colors.textMuted,
                  border: `1px solid ${period === p ? colors.amber : colors.border}`, borderRadius: 8, padding: "5px 10px", fontSize: 12,
                }}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>
        </div>
        {questionRanking.length === 0 && <div style={{ color: colors.textFaint, fontSize: 13 }}>ninguém resolveu questões nesse período ainda.</div>}
        {questionRanking.map((u, i) => {
          const accuracy = u.total > 0 ? Math.round((u.correct / u.total) * 100) : 0;
          const isMe = u.displayName === currentDisplayName;
          return (
            <div key={u.displayName} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: i > 0 ? `1px solid ${colors.border}` : "none" }}>
              <div style={{ width: 20, fontSize: 15, textAlign: "center", flexShrink: 0 }}>{MEDALS[i] || i + 1}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Bar avatar={u.avatar} label={isMe ? `${u.displayName} (você)` : u.displayName} value={u.total} max={maxQuestions} highlight={isMe} />
              </div>
              <div className="mono" style={{ fontSize: 11.5, color: colors.textFaint, width: 60, textAlign: "right", flexShrink: 0 }}>{accuracy}% acerto</div>
            </div>
          );
        })}
      </div>

      {materiaNames.length > 0 && (
        <div style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 18 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>por matéria</div>
            <select
              value={materia}
              onChange={(e) => setMateria(e.target.value)}
              style={{ background: colors.surface2, border: `1px solid ${colors.border}`, borderRadius: 8, color: colors.text, fontSize: 12.5, padding: "6px 10px" }}
            >
              {materiaNames.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          {materiaRanking.length === 0 && <div style={{ color: colors.textFaint, fontSize: 13 }}>ninguém estudou essa matéria ainda.</div>}
          {materiaRanking.map((u) => {
            const accuracy = u.questionsTotal > 0 ? Math.round((u.questionsCorrect / u.questionsTotal) * 100) : null;
            return (
              <div key={u.displayName} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Bar avatar={u.avatar} label={u.displayName === currentDisplayName ? `${u.displayName} (você)` : u.displayName} value={u.estudado} max={materiaRanking[0].estudado} highlight={u.displayName === currentDisplayName} />
                </div>
                {accuracy !== null && (
                  <div className="mono" style={{ fontSize: 11.5, color: colors.textFaint, width: 60, textAlign: "right", flexShrink: 0, marginBottom: 8 }}>{accuracy}% acerto</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
