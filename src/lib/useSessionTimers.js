import { useEffect, useRef, useState } from "react";

// Timers live here (in App, which never unmounts while switching tabs)
// instead of inside SessionTimer itself, so a running session survives
// navigating to another tab and back. Keyed by materiaId; a single
// interval ticks every running timer once a second.
export function useSessionTimers() {
  const [timers, setTimers] = useState({});
  const intervalRef = useRef(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setTimers((prev) => {
        let changed = false;
        const next = { ...prev };
        Object.keys(next).forEach((id) => {
          const t = next[id];
          if (t.running && t.secondsLeft > 0) {
            changed = true;
            const secondsLeft = t.secondsLeft - 1;
            next[id] = { ...t, secondsLeft, running: secondsLeft > 0 };
          }
        });
        return changed ? next : prev;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, []);

  function ensureTimer(materiaId, totalMinutes) {
    const totalSeconds = Math.max(1, Math.round(totalMinutes * 60));
    setTimers((prev) => {
      if (prev[materiaId] && prev[materiaId].totalSeconds === totalSeconds) return prev;
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

  return { timers, ensureTimer, start, pause, reset };
}
