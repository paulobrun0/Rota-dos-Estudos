import { todayISO } from "./date.js";

export function useTopicActions({ updateActive, setData, activeConcurso }) {
  function changeTopic(materiaId, topicId, update) {
    updateActive((concurso) => {
      const clone = structuredClone(concurso);
      const topic = clone.materias.find((materia) => materia.id === materiaId)?.topics.find((item) => item.id === topicId);
      if (!topic) return concurso;
      update(topic);
      return clone;
    });
  }

  function updateTopicNotes(materiaId, topicId, notes) {
    changeTopic(materiaId, topicId, (topic) => { topic.notes = notes; });
  }

  function updateTopicLink(materiaId, topicId, links) {
    changeTopic(materiaId, topicId, (topic) => { topic.links = links; delete topic.link; });
  }

  function updateTopicMaterials(materiaId, topicId, materials) {
    changeTopic(materiaId, topicId, topic => { topic.materials = materials; });
  }

  function setTopicQuestions(materiaId, topicId, total, correct) {
    changeTopic(materiaId, topicId, (topic) => {
      topic.questionsTotal = Math.max(0, Math.trunc(total));
      topic.questionsCorrect = Math.min(topic.questionsTotal, Math.max(0, Math.trunc(correct)));
    });
  }

  function addTopicQuestions(materiaId, topicId, total, correct) {
    if (!activeConcurso || total <= 0) return;
    const activeId = activeConcurso.id;
    const iso = todayISO();
    setData((previous) => {
      if (!previous) return previous;
      const clone = structuredClone(previous);
      const concurso = clone.concursos.find((item) => item.id === activeId);
      const topic = concurso?.materias.find((materia) => materia.id === materiaId)?.topics.find((item) => item.id === topicId);
      if (!topic) return previous;
      const safeCorrect = Math.min(total, Math.max(0, correct));
      topic.lastPracticeDate = iso;
      topic.questionsTotal = (topic.questionsTotal || 0) + total;
      topic.questionsCorrect = (topic.questionsCorrect || 0) + safeCorrect;
      clone.questionActivity ||= {};
      const bucket = clone.questionActivity[iso] || { total: 0, correct: 0 };
      clone.questionActivity[iso] = { total: bucket.total + total, correct: bucket.correct + safeCorrect };
      return clone;
    });
  }

  return { updateTopicNotes, updateTopicLink, updateTopicMaterials, setTopicQuestions, addTopicQuestions };
}
