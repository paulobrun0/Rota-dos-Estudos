import { useEffect, useState } from "react";

const STORAGE_KEY = "ciclo-estudos-theme";

function getInitialTheme() {
  const current = document.documentElement.dataset.theme;
  if (current === "light" || current === "dark") return current;
  return "light";
}

export function useTheme() {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#0C1821" : "#F3F7F9");
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // ignore storage errors (e.g. private browsing)
    }
  }, [theme]);

  return [theme, setTheme];
}
