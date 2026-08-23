import React from "react";
import { Clock, Layers, Target } from "lucide-react";
import { colors } from "../styles/colors.js";
import { inputStyle } from "../styles/shared.js";
import { addDaysISO, formatDatePretty, todayISO } from "../lib/date.js";
import { rotationMateriaIds } from "../lib/planner.js";
import { defaultSettings } from "../data/model.js";
import { SectionLabel } from "../components/SectionLabel.jsx";

export function MetasView({ concurso, updateSettings }) {
  const settings = concurso.settings || defaultSettings();
  const materiasPerDay = settings.materiasPerDay || 0;
  const topicsPerDay = settings.topicsPerDay || 0;
  const minutesPerMateria = settings.minutesPerMateria || 0;
  const totalMaterias = concurso.materias.length;
  const effectivePerDay = materiasPerDay > 0 ? Math.min(materiasPerDay, totalMaterias) : totalMaterias;

  const preview = Array.from({ length: 7 }, (_, i) => {
    const iso = addDaysISO(todayISO(), i);
    const ids = rotationMateriaIds(concurso.materias, settings, iso);
    const names = ids.map((id) => concurso.materias.find((m) => m.id === id)?.name).filter(Boolean);
    return { iso, names };
  });

  return (
    <div>
      <div className="sg" style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>metas</div>
      <div style={{ fontSize: 13.5, color: colors.textMuted, marginBottom: 20 }}>
        três números só, para <b style={{ color: colors.text }}>{concurso.name}</b>. o app decide sozinho quais matérias entram em cada dia, revezando entre todas as cadastradas no edital, e monta a semana inteira automaticamente.
      </div>

      <div style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 12, padding: "18px 20px", marginBottom: 22, display: "flex", flexDirection: "column", gap: 18 }}>
        <GlobalGoalRow
          icon={<Layers size={15} color={colors.amber} />}
          label="matérias por dia"
          hint={materiasPerDay === 0 ? `0 = todas as ${totalMaterias || 0} matérias, todo dia (sem revezamento)` : `revezando de ${effectivePerDay} em ${effectivePerDay}, entre as ${totalMaterias} matérias cadastradas`}
          value={materiasPerDay}
          onChange={(v) => updateSettings("materiasPerDay", v)}
        />
        <GlobalGoalRow
          icon={<Target size={15} color={colors.amber} />}
          label="assuntos por matéria"
          hint="quantos assuntos novos puxar de cada matéria escalada para o dia"
          value={topicsPerDay}
          onChange={(v) => updateSettings("topicsPerDay", v)}
        />
        <GlobalGoalRow
          icon={<Clock size={15} color={colors.amber} />}
          label="minutos por matéria"
          hint="tempo total da sessão daquela matéria — dividido entre os assuntos do dia"
          value={minutesPerMateria}
          onChange={(v) => updateSettings("minutesPerMateria", v)}
          step={5}
        />
      </div>

      {concurso.materias.length === 0 ? (
        <div style={{ color: colors.textFaint, fontSize: 14 }}>cadastre matérias na aba edital para ver a prévia da semana aqui.</div>
      ) : (
        <>
          <SectionLabel text="prévia do revezamento" />
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {preview.map(({ iso, names }, i) => (
              <div key={iso} style={{ display: "flex", gap: 12, alignItems: "baseline", background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 8, padding: "9px 14px" }}>
                <div className="mono" style={{ fontSize: 11.5, color: colors.textFaint, width: 70, flexShrink: 0, textTransform: "capitalize" }}>
                  {i === 0 ? "hoje" : formatDatePretty(iso).split(",")[0]}
                </div>
                <div style={{ fontSize: 13, color: names.length ? colors.text : colors.textFaint }}>
                  {names.length ? names.join(" · ") : "nenhuma matéria elegível"}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function GlobalGoalRow({ icon, label, hint, value, onChange, step = 1 }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <input
        type="number" min={0} step={step}
        value={value}
        onChange={(e) => onChange(Math.max(0, parseInt(e.target.value) || 0))}
        style={{ ...inputStyle, width: 64, padding: "8px 10px", fontSize: 14, flex: "none", fontWeight: 600, textAlign: "center" }}
      />
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, fontWeight: 600 }}>{icon}{label}</div>
        <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>{hint}</div>
      </div>
    </div>
  );
}
