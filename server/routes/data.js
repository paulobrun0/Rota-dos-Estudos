import { Router } from "express";
import { parsePlanData } from "../../src/lib/planValidation.js";

export function createDataRouter(db, requireAuth) {
  const router = Router();
  router.use(requireAuth);
  const getData = db.prepare("SELECT value, revision FROM user_data WHERE user_id = ?");
  const writeData = db.prepare(`
    INSERT INTO user_data (user_id, value, revision, updated_at) VALUES (?, ?, 1, datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET value = excluded.value,
      revision = user_data.revision + 1, updated_at = excluded.updated_at
    WHERE user_data.revision = ?
  `);

  router.get("/", (req, res) => {
    const row = getData.get(req.userId);
    res.json({ value: row?.value ?? null, revision: row?.revision ?? 0 });
  });

  router.put("/", (req, res) => {
    const { value, revision } = req.body || {};
    if (typeof value !== "string") return res.status(400).json({ error: "value deve ser uma string JSON" });
    if (!Number.isSafeInteger(revision) || revision < 0) {
      return res.status(428).json({ error: "Atualize o aplicativo antes de salvar: falta a versão do plano.", code: "REVISION_REQUIRED" });
    }
    try {
      parsePlanData(value);
    } catch (error) {
      return res.status(400).json({ error: error.message, code: "INVALID_PLAN" });
    }
    // The read and compare-and-swap run in one transaction. A second process
    // cannot insert a new row between the missing-row check and the write.
    db.exec("BEGIN IMMEDIATE");
    try {
      const current = getData.get(req.userId);
      if (current && current.revision > revision && current.value === value) {
        db.exec("COMMIT");
        return res.json({ ok: true, revision: current.revision });
      }
      if ((current?.revision ?? 0) !== revision) {
        db.exec("ROLLBACK");
        return res.status(409).json({ error: "Seu plano foi alterado em outra aba. Baixe suas alterações e recarregue o plano.", code: "PLAN_CONFLICT" });
      }
      writeData.run(req.userId, value, revision);
      const next = getData.get(req.userId).revision;
      db.exec("COMMIT");
      res.json({ ok: true, revision: next });
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  });
  return router;
}
