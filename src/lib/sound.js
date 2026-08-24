let audioCtx = null;

function getAudioContext() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  if (!audioCtx) audioCtx = new Ctx();
  if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
  return audioCtx;
}

function playNotes(notes) {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  notes.forEach(({ freq, start, duration }) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, now + start);
    gain.gain.linearRampToValueAtTime(0.2, now + start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + start + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + start);
    osc.stop(now + start + duration + 0.02);
  });
}

// Short two-note ascending chime, synthesized on the fly — no audio asset to
// ship or license, and it works offline like the rest of the app.
export function playCompleteSound() {
  playNotes([
    { freq: 880, start: 0, duration: 0.12 },
    { freq: 1318.5, start: 0.1, duration: 0.18 },
  ]);
}

// Softer three-note descending pattern, distinct from the completion chime,
// so a break ending doesn't sound like another topic getting checked off.
export function playRestOverSound() {
  playNotes([
    { freq: 784, start: 0, duration: 0.12 },
    { freq: 659.25, start: 0.13, duration: 0.12 },
    { freq: 523.25, start: 0.26, duration: 0.2 },
  ]);
}
