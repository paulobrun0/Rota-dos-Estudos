// One writer per mounted app. Every queued snapshot carries the revision of
// the last successful read/write; a conflict never triggers a blind retry.
export function createPlanPersistence({ read, write, decode, onData, onState, cache, delay = 400, retryDelay = 1500 }) {
  let ready = false;
  let disposed = false;
  let revision = 0;
  let saved = null;
  let pending = null;
  let uncertain = null;
  let inFlight = null;
  let timer = null;
  let failures = 0;
  let blocked = false;
  let state = { status: "loading", error: "", dirty: false };

  function publish(status, error = "") {
    state = { status, error, dirty: status === "saving" || uncertain !== null || (pending !== null && pending !== saved) };
    if (!disposed) onState(state);
  }

  function remember() {
    try {
      if (pending !== null && (pending !== saved || uncertain !== null)) cache?.write({ value: pending, revision });
      else if (saved !== null) cache?.clear(saved);
    } catch {
      // Storage may be disabled or full. Network persistence and the in-memory
      // pending snapshot still work; beforeunload warns before leaving.
    }
  }

  function schedule(ms = delay) {
    clearTimeout(timer);
    if (!disposed && ready && !blocked && !inFlight) timer = setTimeout(() => { void flush(); }, ms);
  }

  async function load() {
    if (disposed) return;
    ready = false;
    publish("loading");
    try {
      const result = await read();
      const data = decode(result.value);
      if (disposed) return;
      revision = result.revision;
      saved = result.value;
      pending = null;
      failures = 0;
      blocked = false;
      ready = true;
      let recovered;
      try { recovered = cache?.read(); } catch { /* optional browser storage */ }
      if (recovered && typeof recovered.value === "string" && Number.isSafeInteger(recovered.revision)) {
        let recoveredData;
        try { recoveredData = decode(recovered.value); } catch { recoveredData = null; }
        if (recoveredData && recovered.value !== saved) {
          pending = JSON.stringify(recoveredData);
          blocked = recovered.revision !== revision;
          if (blocked) revision = recovered.revision;
          onData(recoveredData);
          publish(blocked ? "conflict" : "pending", blocked ? "Suas alterações foram recuperadas, mas o servidor tem uma versão mais recente." : "");
          if (!blocked) schedule();
          return;
        }
      }
      pending = JSON.stringify(data);
      onData(data);
      remember();
      publish(pending === saved ? "saved" : "pending");
      if (pending !== saved) schedule();
    } catch (error) {
      if (!disposed) publish("load-error", error.message);
    }
  }

  function queue(data) {
    if (!ready || disposed) return;
    pending = JSON.stringify(data);
    remember();
    if (blocked) { publish("conflict", state.error); return; }
    if (pending === saved && !inFlight && uncertain === null) {
      clearTimeout(timer);
      publish("saved");
    } else if (!blocked) {
      publish(inFlight ? "saving" : "pending");
      schedule();
    }
  }

  async function flush() {
    clearTimeout(timer);
    if (inFlight) return inFlight;
    if (!ready || disposed || blocked || pending === null || (pending === saved && uncertain === null)) return;
    const snapshot = uncertain ?? pending;
    publish("saving");
    inFlight = (async () => {
      try {
        const result = await write(snapshot, revision);
        if (disposed) return;
        revision = result.revision;
        saved = snapshot;
        uncertain = null;
        remember();
        failures = 0;
        publish(pending === saved ? "saved" : "pending");
      } catch (error) {
        if (disposed) return;
        failures += 1;
        if (!error.status || error.status >= 500) uncertain = snapshot;
        blocked = error.status === 409;
        if (error.status >= 400 && error.status < 500) failures = 4;
        publish(error.status === 409 ? "conflict" : "save-error", error.message);
      } finally {
        inFlight = null;
        if (!disposed && !blocked && (pending !== saved || uncertain !== null)) {
          if (failures === 0) schedule(0);
          else if (failures <= 3) schedule(retryDelay * 2 ** (failures - 1));
        }
      }
    })();
    return inFlight;
  }

  function retry() {
    if (!ready) return load();
    if (blocked) return; // reload/export is required for a conflict or invalid payload
    failures = 0;
    return flush();
  }

  function dispose() {
    disposed = true;
    clearTimeout(timer);
  }

  return { load, queue, flush, retry, dispose, getState: () => state };
}
