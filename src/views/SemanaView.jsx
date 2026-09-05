import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { colors } from "../styles/colors.js";
import { navBtnStyle } from "../styles/shared.js";
import { addDaysISO, daysSinceEpoch, fromISO, todayISO, weekStart } from "../lib/date.js";
import { projectActiveMateriaIds } from "../lib/planner.js";

export function SemanaView({ concurso, weekAnchor, setWeekAnchor, weekDays, onOpenDay }) {
  const today = todayISO();
  const todayOffset = daysSinceEpoch(today);
  const weeks = Array.from({ length: Math.ceil(weekDays.length / 7) }, (_, index) => weekDays.slice(index * 7, index * 7 + 7));
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
        <button onClick={() => setWeekAnchor(addDaysISO(weekAnchor, -7))} style={navBtnStyle}><ChevronLeft size={16} /></button>
        <div className="sg" style={{ fontSize: 20, fontWeight: 700 }}>semana</div>
        <button onClick={() => setWeekAnchor(addDaysISO(weekAnchor, 7))} style={navBtnStyle}><ChevronRight size={16} /></button>
        <button onClick={() => setWeekAnchor(weekStart(today))} style={{ ...navBtnStyle, width: "auto", padding: "0 12px", fontSize: 13, color: colors.amber, marginLeft: 4 }}>
          semana atual
        </button>
      </div>

      {weeks.map((days) => {
        const firstDay = fromISO(days[0]);
        const lastDay = fromISO(days[days.length - 1]);
        return (
          <section key={days[0]} style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11.5, color: colors.textFaint, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600, margin: "0 2px 10px" }}>
              {firstDay.getDate()} - {lastDay.getDate()} de {firstDay.toLocaleDateString("pt-BR", { month: "long" })}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 8 }}>
              {days.map((iso) => {
                const plan = concurso.dailyPlans[iso];
                const isToday = iso === today;
                const isFuture = iso > today;
                const done = plan ? plan.filter((c) => c.feito).length : 0;
                const total = plan ? plan.length : null;
                const d = fromISO(iso);
                const diaSemana = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"][d.getDay()];

                // Future days aren't real plans yet — what actually happens
                // depends on how much gets finished between now and then.
                // This is just a projection assuming everything stays on
                // schedule, so an off day doesn't throw it off forever.
                let projectedTotal = null;
                if (total === null && isFuture) {
                  const dayOffset = daysSinceEpoch(iso) - todayOffset;
                  const activeIds = projectActiveMateriaIds(concurso.materias, concurso.settings, concurso.cycleCursor, dayOffset);
                  projectedTotal = activeIds.length * (concurso.settings?.topicsPerDay || 0);
                }

                return (
                  <button
                    key={iso}
                    onClick={() => onOpenDay(iso)}
                    style={{
                      textAlign: "left", background: isToday ? colors.surface2 : colors.surface,
                      border: `1px solid ${isToday ? colors.amber : colors.border}`, borderRadius: 12,
                      padding: "12px 10px", minHeight: 108, display: "flex", flexDirection: "column", gap: 8,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 11, color: colors.textFaint, textTransform: "uppercase", fontWeight: 600 }}>{diaSemana}</div>
                      <div className="sg" style={{ fontSize: 16, fontWeight: 700 }}>{d.getDate()}</div>
                    </div>
                    {total === null ? (
                      <div style={{ fontSize: 11.5, color: colors.textFaint }}>
                        {isFuture ? (projectedTotal > 0 ? `~${projectedTotal} previstos` : "previsão vazia") : "sem plano"}
                      </div>
                    ) : total === 0 ? (
                      <div style={{ fontSize: 11.5, color: colors.textFaint }}>vazio</div>
                    ) : (
                      <div>
                        <div className="mono" style={{ fontSize: 13, color: done === total ? colors.teal : colors.text }}>{done}/{total}</div>
                        <div style={{ height: 4, background: colors.borderSoft, borderRadius: 2, marginTop: 4 }}>
                          <div style={{ height: 4, width: `${total ? (done / total) * 100 : 0}%`, background: colors.amber, borderRadius: 2 }} />
                        </div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
