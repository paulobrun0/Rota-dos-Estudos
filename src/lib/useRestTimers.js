import { useEffect, useRef, useState } from "react";

// Same shape as useSessionTimers (lives in App so it survives tab switches;
// reads/writes through a ref in the tick so StrictMode's double-invoked
// updaters can't fire onFinish twice), but simpler: one plain countdown per
// materiaId, no segments — just how long the break lasts.
export function useRestTimers(onFinish) {
  const [timers, setTimers] = useState({});
  const timersRef = useRef(timers);
  const onFinishRef = useRef(onFinish);

  useEffect(() => {
    timersRef.current = timers;
  }, [timers]);

  useEffect(() => {
    onFinishRef.current = onFinish;
  }, [onFinish]);

  useEffect(() => {
    const interval = setInterval(() => {
      const prev = timersRef.current;
      const next = {};
      const finished = [];
      let changed = false;
      Object.keys(prev).forEach((id) => {
        const t = prev[id];
        if (t.running && t.secondsLeft > 0) {
          changed = true;
          const secondsLeft = t.secondsLeft - 1;
          next[id] = { ...t, secondsLeft, running: secondsLeft > 0 };
          if (secondsLeft === 0) finished.push(id);
        } else {
          next[id] = t;
        }
      });
      if (changed) {
        timersRef.current = next;
        setTimers(next);
      }
      finished.forEach((id) => onFinishRef.current?.(id));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  function ensureTimer(materiaId, totalMinutes) {
    const totalSeconds = Math.max(1, Math.round(totalMinutes * 60));
    setTimers((prev) => {
      const existing = prev[materiaId];
      if (existing && existing.totalSeconds === totalSeconds) return prev;
      return { ...prev, [materiaId]: { totalSeconds, secondsLeft: totalSeconds, running: false } };
    });
  }

  function start(materiaId) {
    setTimers((prev) => (prev[materiaId] ? { ...prev, [materiaId]: { ...prev[materiaId], running: true } } : prev));
  }

  function pause(materiaId) {
    setTimers((prev) => (prev[materiaId] ? { ...prev, [materiaId]: { ...prev[materiaId], running: false } } : prev));
  }

  function reset(materiaId) {
    setTimers((prev) =>
      prev[materiaId]
        ? { ...prev, [materiaId]: { ...prev[materiaId], running: false, secondsLeft: prev[materiaId].totalSeconds } }
        : prev
    );
  }

  function dismiss(materiaId) {
    setTimers((prev) => {
      if (!(materiaId in prev)) return prev;
      const next = { ...prev };
      delete next[materiaId];
      return next;
    });
  }

  return { timers, ensureTimer, start, pause, reset, dismiss };
}
