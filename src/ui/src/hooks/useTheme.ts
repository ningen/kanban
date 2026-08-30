import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "kanban-theme";

function systemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function currentTheme(): Theme {
  const attr = document.documentElement.getAttribute("data-theme");
  if (attr === "light" || attr === "dark") return attr;
  return systemTheme();
}

/**
 * Light/dark theme with OS-follow by default and a manual override persisted
 * to localStorage. The initial value is set pre-paint in index.html to avoid
 * a flash; this hook reads and toggles it.
 */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(currentTheme);

  // Keep in sync with system preference changes when no manual override is set.
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => {
      if (localStorage.getItem(STORAGE_KEY) === null) {
        const next = systemTheme();
        setTheme(next);
        document.documentElement.setAttribute("data-theme", next);
      }
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const setThemeValue = useCallback((next: Theme) => {
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem(STORAGE_KEY, next);
  }, []);

  const toggle = useCallback(() => {
    setThemeValue(theme === "dark" ? "light" : "dark");
  }, [theme, setThemeValue]);

  return { theme, setTheme: setThemeValue, toggle };
}
