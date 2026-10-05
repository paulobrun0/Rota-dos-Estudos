import { preservePractice } from "./practiceHistory.js";
import { useCallback, useEffect, useRef, useState } from "react";
import { fetchPlanData, savePlanData } from "../api/planData.js";
import { defaultData, makeConcurso, migrate } from "../data/model.js";
import { parsePlanData } from "./planValidation.js";
import { createPlanPersistence } from "./planPersistence.js";

function decode(value) {
  const data = value === null ? defaultData() : migrate(parsePlanData(value));
  if (data.concursos.length === 0) {
    const concurso = makeConcurso("Meu concurso", 0);
    return { ...data, concursos: [concurso], activeConcursoId: concurso.id };
  }
  if (!data.activeConcursoId) data.activeConcursoId = data.concursos[0].id;
  return data;
}

export function usePlanData(accountKey) {
  const [data, setRawData] = useState(null);
  const setData = useCallback(update => setRawData(previous => typeof update === "function" ? preservePractice(previous, update(previous)) : update), []);
  const [sync, setSync] = useState({ status: "loading", error: "", dirty: false });
  const controller = useRef(null);

  useEffect(() => {
    const key = `rota-plan-pending:${accountKey}`;
    const cache = {
      read: () => JSON.parse(localStorage.getItem(key) || "null"),
      write: (value) => localStorage.setItem(key, JSON.stringify(value)),
      clear: (value) => { if (JSON.parse(localStorage.getItem(key) || "null")?.value === value) localStorage.removeItem(key); },
    };
    const instance = createPlanPersistence({ cache, read: fetchPlanData, write: savePlanData, decode, onData: setRawData, onState: setSync });
    controller.current = instance;
    void instance.load();
    return () => instance.dispose();
  }, [accountKey]);

  useEffect(() => {
    if (data) controller.current?.queue(data);
  }, [data]);

  useEffect(() => {
    function beforeUnload(event) {
      if (!controller.current?.getState().dirty) return;
      event.preventDefault();
      event.returnValue = "";
    }
    function reconnect() { void controller.current?.retry(); }
    window.addEventListener("beforeunload", beforeUnload);
    window.addEventListener("online", reconnect);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      window.removeEventListener("online", reconnect);
    };
  }, []);

  return { data, setData, sync, retry: () => controller.current?.retry(), flush: async () => {
    const instance = controller.current;
    await instance?.flush();
    if (instance?.getState().status === "pending") await instance.flush();
    return !!instance?.getState().dirty;
  } };
}
