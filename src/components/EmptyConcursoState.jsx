import React from "react";
import { GraduationCap } from "lucide-react";
import { colors } from "../styles/colors.js";
import { primaryBtnStyle } from "../styles/shared.js";

export function EmptyConcursoState({ onGo }) {
  return (
    <div style={{ textAlign: "center", padding: "80px 20px", color: colors.textMuted }}>
      <GraduationCap size={28} color={colors.textFaint} style={{ marginBottom: 12 }} />
      <div className="sg" style={{ fontSize: 16, fontWeight: 700, color: colors.text, marginBottom: 6 }}>nenhum concurso selecionado</div>
      <div style={{ fontSize: 13.5, marginBottom: 16 }}>crie ou escolha um concurso para ver o cronograma.</div>
      <button onClick={onGo} style={{ ...primaryBtnStyle, marginTop: 0, display: "inline-flex" }}>ir para concursos</button>
    </div>
  );
}
