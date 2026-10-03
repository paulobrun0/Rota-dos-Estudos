import { isSafeStudyLink } from "./planValidation.js";

export const STUDY_PLATFORMS = [
  { key: "qconcursos", label: "Qconcursos" },
  { key: "tec", label: "Tec Concursos" },
  { key: "other", label: "Outro caderno" },
];

export function getTopicLinks(topic) {
  const links = { ...(topic.links || {}) };
  if (topic.link && isSafeStudyLink(topic.link)) {
    const host = new URL(topic.link).hostname;
    const key = /(^|\.)qconcursos\.com$/.test(host) ? "qconcursos" : /(^|\.)tecconcursos\.com\.br$/.test(host) ? "tec" : "other";
    if (links[key] === undefined) links[key] = topic.link;
  }
  return links;
}

// Qconcursos accepts a public keyword search; it is not a saved account notebook.
export function questionSearchTerm(topic) {
  return String(topic.name || "").replace(/^\s*\d+(?:\.\d+)*[.)]?\s+/, "").trim().slice(0, 250);
}

export function buildQconcursosSearch(term) {
  const query = String(term || "").trim().slice(0, 250);
  if (!query) return null;
  const url = new URL("https://www.qconcursos.com/questoes-de-concursos/questoes");
  url.searchParams.set("q", query);
  return url.href;
}

export const TEC_QUESTIONS_URL = "https://www.tecconcursos.com.br/questoes";
