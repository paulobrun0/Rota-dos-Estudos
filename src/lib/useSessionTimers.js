import { useEffect, useRef, useState } from "react";

// Timers live here (in App, which never unmounts while switching tabs)
// instead of inside SessionTimer itself, so a running session survives
// navigating to another tab and back. Keyed by materiaId; a single
// interval ticks every running timer once a second.
//
// Each timer is a single countdown over the matéria's full session
// (totalMinutes), split into `segments` equal slices (one per topic
// studied that day). As elapsed time crosses each slice boundary — at
// totalMinutes/segments, 2×that, and so on — the clock PAUSES itself and
// the caller's onSegmentComplete(materiaId) fires once. It stays paused
// until something outside calls start(materiaId) again — the caller uses
// that pause to collect info about the topic that just finished (e.g. a
// question-count prompt) before letting the next slice begin.
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
          const crossedBoundary =
            t.completedSegments < t.segments &&
            elapsed >= Math.round(((t.completedSegments + 1) * t.totalSeconds) / t.segments);
          const completedSegments = crossedBoundary ? t.completedSegments + 1 : t.completedSegments;
          if (crossedBoundary) crossings.push(id);
          next[id] = { ...t, secondsLeft, completedSegments, running: crossedBoundary ? false : secondsLeft > 0 };
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

  // Marking a card done/undone by hand (checkbox, not the running clock)
  // doesn't go through the tick loop above, so the countdown otherwise has
  // no idea a segment's worth of work just happened outside of it. This
  // jumps the clock to match how many of the matéria's cards are actually
  // done right now — e.g. finishing 1 of 2 topics without ever starting the
  // timer takes it straight from the full time down to half. Pauses the
  // clock at the new boundary, same as a natural segment crossing would.
  function syncSegments(materiaId, completedSegments) {
    setTimers((prev) => {
      const t = prev[materiaId];
      if (!t) return prev;
      const clamped = Math.max(0, Math.min(t.segments, completedSegments));
      if (clamped === t.completedSegments) return prev;
      const secondsLeft = Math.max(0, t.totalSeconds - Math.round((clamped * t.totalSeconds) / t.segments));
      return { ...prev, [materiaId]: { ...t, completedSegments: clamped, secondsLeft, running: false } };
    });
  }

  return { timers, ensureTimer, start, pause, reset, syncSegments };
}
