import React from "react";
import { CalendarDays, Clock, Coffee, Layers, RotateCw, Target } from "lucide-react";
import { colors } from "../styles/colors.js";
import { inputStyle, secondaryBtnStyle } from "../styles/shared.js";
import { addDaysISO, formatDatePretty, todayISO } from "../lib/date.js";
import { projectActiveMateriaIds, weekdayKey, WEEKDAY_KEYS } from "../lib/planner.js";
import { defaultSettings } from "../data/model.js";
import { SectionLabel } from "../components/SectionLabel.jsx";

const WEEKDAY_LABELS = { dom: "domingo", seg: "segunda", ter: "terça", qua: "quarta", qui: "quinta", sex: "sexta", sab: "sábado" };

export function MetasView({ concurso, updateSettings, setPlanMode, updateCronograma }) {
  const settings = concurso.settings || defaultSettings();
  const planMode = concurso.planMode || "ciclo";
  const materiasPerDay = settings.materiasPerDay || 0;
  const topicsPerDay = settings.topicsPerDay || 0;
  const reviewsPerDay = settings.reviewsPerDay ?? 3;
  const minutesPerMateria = settings.minutesPerMateria || 0;
  const restMinutes = settings.restMinutes ?? 5;
  const totalMaterias = concurso.materias.length;
  const effectivePerDay = materiasPerDay > 0 ? Math.min(materiasPerDay, totalMaterias) : totalMaterias;

  // Day 0 (hoje) is the real, current rotation; days 1-6 are a projection
  // assuming everything stays on schedule — an unfinished day just means
  // the real thing keeps showing today's matérias instead of matching this
  // preview, since the cursor only moves once a matéria is actually done.
  // Cronograma has no such uncertainty (it's calendar-driven, not
  // progress-driven), so every day in its preview is exact, not a guess.
  const preview = Array.from({ length: 7 }, (_, i) => {
    const iso = addDaysISO(todayISO(), i);
    const ids = planMode === "cronograma"
      ? (concurso.cronograma?.[weekdayKey(iso)] || [])
      : projectActiveMateriaIds(concurso.materias, settings, concurso.cycleCursor, i);
    const names = ids.map((id) => concurso.materias.find((m) => m.id === id)?.name).filter(Boolean);
    return { iso, names };
  });

  return (
    <div>
      <div className="sg" style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>metas</div>
      <div style={{ fontSize: 13.5, color: colors.textMuted, marginBottom: 20 }}>
        só alguns números, para <b style={{ color: colors.text }}>{concurso.name}</b>.{" "}
        {planMode === "cronograma"
          ? "cada dia da semana tem sua própria matéria fixa, definida por você — se repete toda semana, sem depender de progresso."
          : "o app decide sozinho quais matérias entram em cada dia, revezando entre todas as cadastradas no edital. o rodízio anda por ciclo, não por calendário: só passa pra próxima matéria quando a atual estiver de fato concluída — um dia mais fraco não te faz perder o que ficou pra trás, você retoma de onde parou."}
      </div>

      <div style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 12, padding: "18px 20px", marginBottom: 22 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>modo de organização</div>
        <div style={{ fontSize: 12, color: colors.textMuted, marginBottom: 12 }}>
          ciclo revezado por progresso, ou cronograma fixo por dia da semana.
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            onClick={() => setPlanMode("ciclo")}
            style={{ ...secondaryBtnStyle, padding: "8px 14px", border: `1px solid ${planMode === "ciclo" ? colors.amber : colors.border}`, color: planMode === "ciclo" ? colors.amber : colors.text }}
          >
            <RotateCw size={14} /> ciclo
          </button>
          <button
            onClick={() => setPlanMode("cronograma")}
            style={{ ...secondaryBtnStyle, padding: "8px 14px", border: `1px solid ${planMode === "cronograma" ? colors.amber : colors.border}`, color: planMode === "cronograma" ? colors.amber : colors.text }}
          >
            <CalendarDays size={14} /> cronograma
          </button>
        </div>
      </div>

      <div style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 12, padding: "18px 20px", marginBottom: 22, display: "flex", flexDirection: "column", gap: 18 }}>
        {planMode === "ciclo" && (
          <GlobalGoalRow
            icon={<Layers size={15} color={colors.amber} />}
            label="matérias por dia"
            hint={materiasPerDay === 0 ? `0 = todas as ${totalMaterias || 0} matérias, todo dia (sem revezamento)` : `revezando de ${effectivePerDay} em ${effectivePerDay}, entre as ${totalMaterias} matérias cadastradas`}
            value={materiasPerDay}
            onChange={(v) => updateSettings("materiasPerDay", v)}
          />
        )}
        <GlobalGoalRow
          icon={<Target size={15} color={colors.amber} />}
          label="assuntos por matéria"
          hint="quantos assuntos novos puxar de cada matéria escalada para o dia"
          value={topicsPerDay}
          onChange={(v) => updateSettings("topicsPerDay", v)}
        />
        <GlobalGoalRow
          icon={<RotateCw size={15} color={colors.amber} />}
          label="revisões por dia"
          hint={reviewsPerDay === 0 ? "revisão espaçada desligada — assuntos já estudados não voltam sozinhos" : `até ${reviewsPerDay} assuntos já estudados voltam por dia, no intervalo certo (1/3/7/15/30 dias) — vindos de qualquer matéria, não só as do dia`}
          value={reviewsPerDay}
          onChange={(v) => updateSettings("reviewsPerDay", v)}
        />
        <GlobalGoalRow
          icon={<Clock size={15} color={colors.amber} />}
          label="minutos por matéria"
          hint="tempo total da sessão daquela matéria — dividido entre os assuntos do dia"
          value={minutesPerMateria}
          onChange={(v) => updateSettings("minutesPerMateria", v)}
          step={5}
        />
        <GlobalGoalRow
          icon={<Coffee size={15} color={colors.amber} />}
          label="minutos de descanso"
          hint={restMinutes === 0 ? "sem pausa automática ao concluir uma matéria" : "pausa que começa sozinha assim que você termina os assuntos da matéria"}
          value={restMinutes}
          onChange={(v) => updateSettings("restMinutes", v)}
          step={5}
        />
      </div>

      {planMode === "cronograma" && (
        <div style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 12, padding: "18px 20px", marginBottom: 22 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>matéria de cada dia</div>
          <div style={{ fontSize: 12, color: colors.textMuted, marginBottom: 14 }}>
            se repete toda semana. um dia sem matéria vira dia livre — só entram as revisões que estiverem no prazo.
          </div>
          {concurso.materias.length === 0 ? (
            <div style={{ color: colors.textFaint, fontSize: 13 }}>cadastre matérias na aba edital antes de montar o cronograma.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {WEEKDAY_KEYS.map((day) => (
                <div key={day} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div className="mono" style={{ width: 76, flexShrink: 0, fontSize: 12, color: colors.textFaint, textTransform: "capitalize" }}>
                    {WEEKDAY_LABELS[day]}
                  </div>
                  <select
                    value={concurso.cronograma?.[day]?.[0] || ""}
                    onChange={(e) => updateCronograma(day, e.target.value ? [e.target.value] : [])}
                    style={{ ...inputStyle, padding: "7px 10px", fontSize: 13.5 }}
                  >
                    <option value="">— dia livre —</option>
                    {concurso.materias.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {concurso.materias.length === 0 ? (
        <div style={{ color: colors.textFaint, fontSize: 14 }}>cadastre matérias na aba edital para ver a prévia da semana aqui.</div>
      ) : (
        <>
          <SectionLabel text={planMode === "cronograma" ? "prévia da semana" : "prévia do revezamento"} />
          <div style={{ fontSize: 12, color: colors.textFaint, marginBottom: 10 }}>
            {planMode === "cronograma"
              ? "exata, não é estimativa — cronograma não depende de progresso."
              : "\"hoje\" é o real; os outros dias são uma estimativa supondo que tudo seja concluído no ritmo — se um dia render menos, os dias reais seguintes se ajustam sozinhos."}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {preview.map(({ iso, names }, i) => (
              <div key={iso} style={{ display: "flex", gap: 12, alignItems: "baseline", background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 8, padding: "9px 14px" }}>
                <div className="mono" style={{ fontSize: 11.5, color: colors.textFaint, width: 70, flexShrink: 0, textTransform: "capitalize" }}>
                  {i === 0 ? "hoje" : formatDatePretty(iso).split(",")[0]}
                </div>
                <div style={{ fontSize: 13, color: names.length ? colors.text : colors.textFaint }}>
                  {names.length ? names.join(" · ") : planMode === "cronograma" ? "dia livre" : "nenhuma matéria elegível"}
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
