const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const weekdays = new Set(["dom", "seg", "ter", "qua", "qui", "sex", "sab"]);

function requireValue(condition, message) {
  if (!condition) throw new Error(`Plano inválido: ${message}.`);
}

function text(value, field) {
  requireValue(typeof value === "string" && value.trim().length > 0, `${field} precisa ser um texto não vazio`);
}

function count(value, field, integer = true) {
  requireValue(typeof value === "number" && Number.isFinite(value) && value >= 0 && (!integer || Number.isSafeInteger(value)), `${field} precisa ser um número não negativo`);
}

function optionalCount(item, key, integer = true) {
  if (item[key] !== undefined) count(item[key], key, integer);
}

function date(value) {
  requireValue(typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value, "data inválida");
}

export function isSafeStudyLink(value) {
  if (value === "") return true;
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password;
  } catch {
    return false;
  }
}

function distinct(items, field) {
  requireValue(Array.isArray(items), `${field} precisa ser uma lista`);
  const ids = new Set();
  for (const item of items) {
    requireValue(object(item), `${field} contém um item inválido`);
    text(item.id, "id");
    requireValue(!ids.has(item.id), `${field} contém ids repetidos`);
    ids.add(item.id);
  }
}

function validateMaterias(materias) {
  distinct(materias, "matérias");
  for (const materia of materias) {
    text(materia.name, "nome da matéria");
    if (materia.weight !== undefined) { count(materia.weight, "peso da matéria", false); requireValue(materia.weight > 0 && materia.weight <= 100, "peso deve estar entre 0 e 100"); }
    distinct(materia.topics, "assuntos");
    for (const topic of materia.topics) {
      text(topic.name, "nome do assunto");
      if (topic.status !== undefined) requireValue(["pendente", "estudado"].includes(topic.status), "status do assunto inválido");
      if (topic.notes !== undefined) requireValue(typeof topic.notes === "string", "anotação inválida");
      if (topic.link !== undefined) requireValue(isSafeStudyLink(topic.link), "link precisa começar com http ou https");
      if (topic.links !== undefined) {
        requireValue(object(topic.links), "links inválidos");
        for (const link of Object.values(topic.links)) requireValue(isSafeStudyLink(link), "link precisa começar com http ou https");
      }
      if (topic.equivalenceKey !== undefined) { text(topic.equivalenceKey, "equivalência do assunto"); requireValue(topic.equivalenceKey.length <= 1000, "equivalência muito longa"); }
      if (topic.skippedFromShared !== undefined) requireValue(typeof topic.skippedFromShared === "boolean", "aproveitamento inválido");
      if (topic.materials !== undefined) {
        distinct(topic.materials, "materiais");
        for (const material of topic.materials) {
          text(material.name, "nome do material");
          requireValue(isSafeStudyLink(material.url) && Boolean(material.url), "link do material inválido");
          requireValue(["pdf", "video", "notebook", "other"].includes(material.type), "tipo do material inválido");
        }
      }
      optionalCount(topic, "questionsTotal");
      optionalCount(topic, "questionsCorrect");
      requireValue((topic.questionsCorrect || 0) <= (topic.questionsTotal || 0), "acertos excedem o total de questões");
      optionalCount(topic, "reviewStep");
      if (topic.nextReviewDate != null) date(topic.nextReviewDate);
      if (topic.lastPracticeDate != null) date(topic.lastPracticeDate);
      if (topic.history !== undefined) {
        requireValue(Array.isArray(topic.history), "histórico do assunto inválido");
        for (const entry of topic.history) {
          requireValue(object(entry), "registro de histórico inválido"); date(entry.date);
          optionalCount(entry, "questionsTotal"); optionalCount(entry, "questionsCorrect");
          requireValue((entry.questionsCorrect || 0) <= (entry.questionsTotal || 0), "acertos do histórico excedem total");
        }
      }
    }
  }
}

function validateConcurso(concurso) {
  requireValue(object(concurso), "concurso inválido");
  validateMaterias(concurso.materias);
  for (const key of ["banca", "cargo"]) if (concurso[key] !== undefined) requireValue(typeof concurso[key] === "string", `${key} inválido`);
  if (concurso.stage !== undefined) requireValue(["pre", "post", "completed"].includes(concurso.stage), "fase do concurso inválida");
  if (concurso.editalUrl !== undefined) requireValue(isSafeStudyLink(concurso.editalUrl), "link do edital inválido");
  if (concurso.simulados !== undefined) {
    distinct(concurso.simulados, "simulados");
    for (const exam of concurso.simulados) {
      text(exam.name, "nome do simulado"); date(exam.date); count(exam.minutes, "tempo do simulado", false);
      requireValue(typeof exam.banca === "string", "banca do simulado inválida");
      requireValue(Array.isArray(exam.rows) && exam.rows.length > 0, "simulado sem matérias");
      const ids = new Set();
      for (const row of exam.rows) {
        text(row.materiaId, "matéria do simulado"); text(row.materiaName, "nome da matéria do simulado");
        requireValue(!ids.has(row.materiaId), "matéria repetida no simulado"); ids.add(row.materiaId);
        count(row.total, "questões do simulado"); count(row.correct, "acertos do simulado"); count(row.weight, "peso", false);
        requireValue(row.total > 0 && row.correct <= row.total && row.weight > 0, "resultado do simulado inválido");
      }
    }
  }
  if (concurso.settings !== undefined) {
    requireValue(object(concurso.settings), "metas inválidas");
    for (const key of ["materiasPerDay", "topicsPerDay", "minutesPerMateria", "restMinutes", "reviewsPerDay"]) optionalCount(concurso.settings, key);
  }
  if (concurso.examDate != null) date(concurso.examDate);
  if (concurso.planMode !== undefined) requireValue(["ciclo", "cronograma"].includes(concurso.planMode), "modo do plano inválido");
  if (concurso.dailyPlans !== undefined) {
    requireValue(object(concurso.dailyPlans), "planos diários inválidos");
    for (const [iso, cards] of Object.entries(concurso.dailyPlans)) {
      date(iso);
      distinct(cards, "cards");
      for (const card of cards) {
        text(card.materiaId, "matéria do card");
        text(card.topicId, "assunto do card");
        requireValue(typeof card.feito === "boolean", "conclusão do card inválida");
        requireValue(["novo", "revisao"].includes(card.tipo), "tipo do card inválido");
      }
    }
  }
  if (concurso.cronograma !== undefined) {
    requireValue(object(concurso.cronograma), "cronograma inválido");
    for (const [day, ids] of Object.entries(concurso.cronograma)) {
      requireValue(weekdays.has(day) && Array.isArray(ids) && ids.every((id) => typeof id === "string"), "dia do cronograma inválido");
    }
  }
}

// Accepts both current multi-concurso backups and the original single-concurso
// shape. Validation runs before migration, so an unrelated JSON cannot become
// an empty, apparently successful import.
export function validatePlanData(raw) {
  requireValue(object(raw), "o arquivo precisa conter um objeto");
  if (Array.isArray(raw.concursos)) {
    distinct(raw.concursos, "concursos");
    for (const concurso of raw.concursos) {
      text(concurso.name, "nome do concurso");
      validateConcurso(concurso);
    }
    if (raw.activeConcursoId != null) requireValue(raw.concursos.some((c) => c.id === raw.activeConcursoId), "concurso ativo não existe");
  } else {
    requireValue(Array.isArray(raw.materias), "faltam concursos ou matérias");
    validateConcurso(raw);
  }
  if (raw.availableHoursPerWeek != null) { count(raw.availableHoursPerWeek, "horas por semana", false); requireValue(raw.availableHoursPerWeek > 0 && raw.availableHoursPerWeek <= 168, "horas por semana devem estar entre 0 e 168"); }
  if (raw.practiceArchive !== undefined) {
    distinct(raw.practiceArchive, "histórico preservado");
    for (const row of raw.practiceArchive) {
      for (const field of ["concursoId", "concursoName", "materiaId", "materiaName", "topicId", "key"]) text(row[field], field);
      requireValue(row.id === JSON.stringify([row.concursoId, row.materiaId, row.topicId]), "origem do histórico inválida");
      requireValue(object(row.topic) && row.topic.id === row.topicId, "assunto preservado inválido");
      validateMaterias([{ id: row.materiaId, name: row.materiaName, topics: [row.topic] }]);
    }
  }
  if (raw.studyDays != null) requireValue(Array.isArray(raw.studyDays) && raw.studyDays.every((day) => weekdays.has(day)), "dias de estudo inválidos");
  for (const key of ["activity", "studyMinutes", "questionActivity"]) {
    if (raw[key] === undefined) continue;
    requireValue(object(raw[key]), `${key} inválido`);
    for (const [iso, entry] of Object.entries(raw[key])) {
      date(iso);
      if (key === "questionActivity") {
        requireValue(object(entry), "atividade de questões inválida");
        count(entry.total, "total de questões");
        count(entry.correct, "acertos");
        requireValue(entry.correct <= entry.total, "acertos excedem o total de questões");
      } else count(entry, key, key !== "studyMinutes");
    }
  }
  return raw;
}

export function parsePlanData(value) {
  return validatePlanData(JSON.parse(value));
}
