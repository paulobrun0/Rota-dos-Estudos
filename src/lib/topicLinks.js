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
