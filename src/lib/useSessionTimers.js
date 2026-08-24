import { useEffect, useRef, useState } from "react";

// Timers live here (in App, which never unmounts while switching tabs)
// instead of inside SessionTimer itself, so a running session survives
// navigating to another tab and back. Keyed by materiaId; a single
// interval ticks every running timer once a second.
//
// Each timer is a single countdown over the matéria's full session
// (totalMinutes), split into `segments` equal slices (one per topic
// studied that day). As elapsed time crosses each slice boundary — at
// totalMinutes/segments, 2×that, and so on — the caller's
// onSegmentComplete(materiaId) fires once to mark that topic done. The
// clock itself never resets mid-session; it just counts straight down to
// zero, which coincides with the last topic's boundary.
export function useSessionTimers(onSegmentComplete) {
  const [timers, setTimers] = useState({});
  const timersRef = useRef(timers);
  const intervalRef = useRef(null);
  const onCompleteRef = useRef(onSegmentComplete);

  useEffect(() => {
    timersRef.current = timers;
  }, [timers]);

  useEffect(() => {
    onCompleteRef.current = onSegmentComplete;
  }, [onSegmentComplete]);

  // The tick reads timersRef (a plain ref, not the setState updater form) and
  // computes the next state up front, then commits it with a single plain
  // setTimers(nextValue) call. That's deliberate: React 18 StrictMode invokes
  // functional setState updaters twice in development to surface impure
  // ones, and stuffing a side effect (collecting "crossings" to notify the
  // caller about) inside the updater made onSegmentComplete fire twice per
  // tick — which toggled the same card done and immediately un-done again.
  // Reading from the ref and writing a plain value sidesteps that entirely.
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      const prev = timersRef.current;
      const next = {};
      const crossings = [];
      let changed = false;
      Object.keys(prev).forEach((id) => {
        const t = prev[id];
        if (t.running && t.secondsLeft > 0) {
          changed = true;
          const secondsLeft = t.secondsLeft - 1;
          const elapsed = t.totalSeconds - secondsLeft;
          let completedSegments = t.completedSegments;
          while (
            completedSegments < t.segments &&
            elapsed >= Math.round(((completedSegments + 1) * t.totalSeconds) / t.segments)
          ) {
            completedSegments++;
            crossings.push(id);
          }
          next[id] = { ...t, secondsLeft, completedSegments, running: secondsLeft > 0 };
        } else {
          next[id] = t;
        }
      });
      if (changed) {
        timersRef.current = next;
        setTimers(next);
      }
      crossings.forEach((id) => onCompleteRef.current?.(id));
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, []);

  function ensureTimer(materiaId, totalMinutes, segments) {
    const totalSeconds = Math.max(1, Math.round(totalMinutes * 60));
    const safeSegments = Math.max(1, segments || 1);
    setTimers((prev) => {
      const existing = prev[materiaId];
      if (existing && existing.totalSeconds === totalSeconds && existing.segments === safeSegments) return prev;
      return { ...prev, [materiaId]: { totalSeconds, secondsLeft: totalSeconds, segments: safeSegments, completedSegments: 0, running: false } };
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
        ? { ...prev, [materiaId]: { ...prev[materiaId], running: false, secondsLeft: prev[materiaId].totalSeconds, completedSegments: 0 } }
        : prev
    );
  }

  return { timers, ensureTimer, start, pause, reset };
}
