import React from "react";
import { Check, ChevronLeft, ChevronRight, Flame } from "lucide-react";
import { colors } from "../styles/colors.js";
import { navBtnStyle } from "../styles/shared.js";
import { addDaysISO, formatDatePretty, todayISO } from "../lib/date.js";
import { Ring } from "../components/Ring.jsx";
import { SessionTimer } from "../components/SessionTimer.jsx";
import { RestTimer } from "../components/RestTimer.jsx";

export function DiaView({ selectedDate, setSelectedDate, plan, doneCount, totalCount, pct, materiaById, topicById, materiasOrder, minutesPerMateria, toggleCard, streak, sessionTimers, restTimers }) {
  const isToday = selectedDate === todayISO();
  const novos = plan.filter((c) => c.tipo === "novo");
  const revisoes = plan.filter((c) => c.tipo === "revisao");

  const groupsMap = {};
  plan.forEach((card) => {
    if (!groupsMap[card.materiaId]) groupsMap[card.materiaId] = [];
    groupsMap[card.materiaId].push(card);
  });
  const orderedMateriaIds = materiasOrder.filter((id) => groupsMap[id]);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={() => setSelectedDate(addDaysISO(selectedDate, -1))} style={navBtnStyle}><ChevronLeft size={16} /></button>
          <div>
            <div className="sg" style={{ fontSize: 20, fontWeight: 700, textTransform: "capitalize" }}>
              {isToday ? "hoje" : formatDatePretty(selectedDate)}
            </div>
            {isToday && <div style={{ fontSize: 12.5, color: colors.textMuted, textTransform: "capitalize" }}>{formatDatePretty(selectedDate)}</div>}
          </div>
          <button onClick={() => setSelectedDate(addDaysISO(selectedDate, 1))} style={navBtnStyle}><ChevronRight size={16} /></button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {isToday && streak > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 5, background: colors.amberSoft, color: colors.amber, borderRadius: 20, padding: "6px 12px", fontSize: 12.5, fontWeight: 600 }}>
              <Flame size={14} /> {streak} dia{streak !== 1 ? "s" : ""}
            </div>
          )}
          {!isToday && (
            <button onClick={() => setSelectedDate(todayISO())} style={{ ...navBtnStyle, width: "auto", padding: "0 12px", fontSize: 13, color: colors.amber }}>
              voltar para hoje
            </button>
          )}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 20, background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 14, padding: "18px 22px", marginBottom: 28 }}>
        <Ring pct={pct} />
        <div>
          <div className="sg" style={{ fontSize: 15, fontWeight: 600 }}>
            {totalCount === 0 ? "nada planejado" : `${doneCount} de ${totalCount} cards concluídos`}
          </div>
          <div style={{ fontSize: 13, color: colors.textMuted, marginTop: 2 }}>
            {totalCount === 0
              ? "defina metas nas matérias para gerar o plano do dia."
              : `${novos.length} assunto${novos.length !== 1 ? "s" : ""} novo${novos.length !== 1 ? "s" : ""} · ${revisoes.length} revisão${revisoes.length !== 1 ? "ões" : ""}`}
          </div>
        </div>
      </div>

      {plan.length === 0 && (
        <div style={{ color: colors.textFaint, fontSize: 14, padding: "12px 2px" }}>
          nenhum card para este dia ainda. vá em <b style={{ color: colors.textMuted }}>metas</b> para definir quantos assuntos por matéria você quer estudar por dia.
        </div>
      )}

      {orderedMateriaIds.map((materiaId) => (
        <MateriaGroupCard
          key={materiaId}
          materia={materiaById(materiaId)}
          minutesPerMateria={minutesPerMateria}
          cards={groupsMap[materiaId]}
          topicById={topicById}
          onToggle={(cardId) => toggleCard(selectedDate, cardId)}
          sessionTimers={sessionTimers}
          restTimers={restTimers}
        />
      ))}
    </div>
  );
}

function MateriaGroupCard({ materia, minutesPerMateria, cards, topicById, onToggle, sessionTimers, restTimers }) {
  if (!materia) return null;
  const totalMinutes = minutesPerMateria || 0;
  const perTopic = cards.length > 0 && totalMinutes > 0 ? totalMinutes / cards.length : null;
  const doneInGroup = cards.filter((c) => c.feito).length;
  const allDone = doneInGroup === cards.length;
  const resting = allDone && restTimers.timers[materia.id];

  return (
    <div style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderLeft: `3px solid ${materia.color}`, borderRadius: 12, padding: 16, marginBottom: 14, opacity: allDone && !resting ? 0.75 : 1 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 10 }}>
        <div>
          <div className="sg" style={{ fontSize: 15, fontWeight: 700, color: materia.color }}>{materia.name}</div>
          <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
            {doneInGroup}/{cards.length} concluído{cards.length !== 1 ? "s" : ""}
            {totalMinutes > 0 ? ` · ${totalMinutes} min no total` : ""}
            {perTopic ? ` · ~${Math.round(perTopic)} min por assunto` : ""}
          </div>
        </div>
        {totalMinutes > 0 && !allDone && (
          <SessionTimer materiaId={materia.id} totalMinutes={totalMinutes} segments={cards.length} {...sessionTimers} />
        )}
      </div>

      {resting && <RestTimer materiaId={materia.id} {...restTimers} />}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {cards.map((card) => {
          const topic = topicById(materia, card.topicId);
          if (!topic) return null;
          return <TopicRow key={card.id} card={card} topic={topic} onToggle={() => onToggle(card.id)} />;
        })}
      </div>

      {totalMinutes === 0 && (
        <div style={{ fontSize: 11.5, color: colors.textFaint, marginTop: 10 }}>
          defina os minutos por matéria em metas para ativar o cronômetro.
        </div>
      )}
      {totalMinutes > 0 && !allDone && (
        <div style={{ fontSize: 11.5, color: colors.textFaint, marginTop: 10 }}>
          conforme o tempo passa, cada assunto é marcado como concluído automaticamente na sua vez — sem o cronômetro reiniciar.
        </div>
      )}
    </div>
  );
}

function TopicRow({ card, topic, onToggle }) {
  const isRevisao = card.tipo === "revisao";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, background: colors.surface2, borderRadius: 8, padding: "10px 12px", opacity: card.feito ? 0.55 : 1 }}>
      <button
        onClick={onToggle}
        aria-label={card.feito ? "marcar como não estudado" : "marcar como estudado"}
        style={{
          width: 22, height: 22, borderRadius: "50%", flexShrink: 0, border: `1.5px solid ${card.feito ? colors.amber : colors.border}`,
          background: card.feito ? colors.amber : "transparent", display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        {card.feito && <Check size={13} color={colors.bg} strokeWidth={3} />}
      </button>
      <div style={{ flex: 1, fontSize: 14, textDecoration: card.feito ? "line-through" : "none", color: colors.text }}>{topic.name}</div>
      <div
        className="mono"
        style={{
          fontSize: 10.5, padding: "2px 8px", borderRadius: 20, flexShrink: 0,
          background: isRevisao ? colors.tealSoft : colors.amberSoft,
          color: isRevisao ? colors.teal : colors.amber,
        }}
      >
        {isRevisao ? "revisão · ciclo" : "novo"}
      </div>
    </div>
  );
}
