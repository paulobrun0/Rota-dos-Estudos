import { useEffect, useState } from "react";

const STORAGE_KEY = "ciclo-estudos-sound";

function getInitial() {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved === null ? true : saved === "true";
  } catch {
    return true;
  }
}

export function useSoundEnabled() {
  const [enabled, setEnabled] = useState(getInitial);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(enabled));
    } catch {
      // ignore storage errors (e.g. private browsing)
    }
  }, [enabled]);

  return [enabled, setEnabled];
}
