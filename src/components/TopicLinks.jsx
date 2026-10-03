import React, { useState } from "react";
import { colors } from "../styles/colors.js";
import { inputStyle, secondaryBtnStyle } from "../styles/shared.js";
import { getTopicLinks, STUDY_PLATFORMS } from "../lib/topicLinks.js";
import { isSafeStudyLink } from "../lib/planValidation.js";

export function TopicLinkButtons({ topic }) {
  const links = getTopicLinks(topic);
  return STUDY_PLATFORMS.filter(({ key }) => links[key] && isSafeStudyLink(links[key])).map(({ key, label }) => (
    <a key={key} href={links[key]} target="_blank" rel="noopener noreferrer" aria-label={`abrir ${label}`} style={{ color: colors.teal, fontSize: 11, padding: "4px 0" }}>{label}</a>
  ));
}

export function TopicLinksEditor({ topic, onSave, onClose }) {
  const [draft, setDraft] = useState(() => getTopicLinks(topic));
  const [error, setError] = useState("");
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
      {STUDY_PLATFORMS.map(({ key, label }, index) => (
        <label key={key} style={{ display: "grid", gap: 4, fontSize: 12, color: colors.textMuted }}>
          {label}
          <input autoFocus={index === 0} type="url" value={draft[key] || ""} placeholder="https://…" onChange={(event) => setDraft((previous) => ({ ...previous, [key]: event.target.value }))} style={inputStyle} />
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
