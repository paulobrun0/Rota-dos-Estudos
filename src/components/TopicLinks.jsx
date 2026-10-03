import React, { useState } from "react";
import { colors } from "../styles/colors.js";
import { inputStyle, secondaryBtnStyle } from "../styles/shared.js";
import { getTopicLinks, STUDY_PLATFORMS, questionSearchTerm, buildQconcursosSearch, TEC_QUESTIONS_URL } from "../lib/topicLinks.js";
import { isSafeStudyLink } from "../lib/planValidation.js";

export function TopicLinkButtons({ topic }) {
  const links = getTopicLinks(topic);
  return STUDY_PLATFORMS.filter(({ key }) => links[key] && isSafeStudyLink(links[key])).map(({ key, label }) => (
    <a key={key} href={links[key]} target="_blank" rel="noopener noreferrer" aria-label={`abrir ${label}`} style={{ color: colors.success, fontSize: 11, padding: "4px 0" }}>{label}</a>
  ));
}

export function TopicLinksEditor({ topic, onSave, onClose }) {
  const [draft, setDraft] = useState(() => getTopicLinks(topic));
  const [error, setError] = useState("");
  const [term, setTerm] = useState(() => questionSearchTerm(topic));
  const [copyMessage, setCopyMessage] = useState("");
  const searchUrl = buildQconcursosSearch(term);
  async function copyTerm() {
    try {
      await navigator.clipboard.writeText(term.trim());
      setCopyMessage("Assunto copiado. Cole na busca ou selecione o assunto nos filtros do TEC.");
    } catch {
      setCopyMessage("Não foi possível copiar. Selecione o texto do campo acima e copie manualmente.");
    }
  }
  function save(event) {
    event.preventDefault();
    const links = Object.fromEntries(STUDY_PLATFORMS.map(({ key }) => [key, (draft[key] || "").trim()]));
    if (Object.values(links).some((link) => !isSafeStudyLink(link))) {
      setError("Use um endereço completo começando com https:// ou http://.");
      return;
    }
    onSave(links);
    onClose();
  }
  return (
    <form onSubmit={save} style={{ display: "grid", gap: 8, marginTop: 10 }}>
      <div style={{ background: colors.surface2, border: `1px solid ${colors.border}`, borderRadius: 10, padding: 12, display: "grid", gap: 10 }}>
        <div style={{ fontWeight: 650, fontSize: 13 }}>Encontrar questões deste assunto</div>
        <label style={{ display: "grid", gap: 5, fontSize: 12, color: colors.textMuted }}>Assunto para buscar<input autoFocus value={term} maxLength={250} onChange={event => { setTerm(event.target.value); setCopyMessage(""); }} style={inputStyle} /></label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {searchUrl && <a href={searchUrl} target="_blank" rel="noopener noreferrer" style={{ ...secondaryBtnStyle, textDecoration: "none" }}>Buscar no Qconcursos ↗</a>}
          <button type="button" onClick={copyTerm} disabled={!term.trim()} style={secondaryBtnStyle}>Copiar assunto para o TEC</button>
          <a href={TEC_QUESTIONS_URL} target="_blank" rel="noopener noreferrer" style={{ ...secondaryBtnStyle, textDecoration: "none" }}>Abrir TEC Concursos ↗</a>
        </div>
        {copyMessage && <div role="status" style={{ fontSize: 12, color: colors.textMuted }}>{copyMessage}</div>}
        <p style={{ fontSize: 12, lineHeight: 1.6, color: colors.textMuted, margin: 0 }}>No Qconcursos, a busca abre pelo texto acima; confira a disciplina e os filtros. No TEC, copie o assunto e selecione os filtros na plataforma. Salve o caderno na sua conta e cole o link abaixo para abrir diretamente nas próximas vezes.</p>
      </div>
      <div style={{ fontWeight: 650, fontSize: 13 }}>Vincular cadernos salvos</div>
      {STUDY_PLATFORMS.map(({ key, label }) => (
        <label key={key} style={{ display: "grid", gap: 4, fontSize: 12, color: colors.textMuted }}>
          {label}
          <input type="url" value={draft[key] || ""} placeholder="https://…" onChange={(event) => setDraft((previous) => ({ ...previous, [key]: event.target.value }))} style={inputStyle} />
        </label>
      ))}
      {error && <p role="alert" style={{ color: colors.red }}>{error}</p>}
      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" style={secondaryBtnStyle}>salvar links</button>
        <button type="button" onClick={onClose} style={secondaryBtnStyle}>cancelar</button>
      </div>
    </form>
  );
}
