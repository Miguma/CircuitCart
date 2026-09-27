"use client";

import React, { createContext, useContext, useEffect, useCallback, useSyncExternalStore } from "react";

export type Theme = "default" | "light" | "dark";

export interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  isMounted: boolean;
}

const THEME_STORAGE_KEY = "circuitcart-theme";
const VALID_THEMES: Theme[] = ["default", "light", "dark"];

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function applyThemeToDocument(theme: Theme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;

  root.setAttribute("data-theme", theme);

  if (theme === "dark") {
    root.classList.add("dark");
    root.classList.remove("light");
  } else if (theme === "light") {
    root.classList.add("light");
    root.classList.remove("dark");
  } else {
    // Default theme: signature CircuitCart plum appearance
    root.classList.remove("dark", "light");
  }
}

function subscribe(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", callback);
  window.addEventListener("circuitcart-theme-change", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("circuitcart-theme-change", callback);
  };
}

function getSnapshot(): Theme {
  if (typeof window === "undefined") return "default";
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
    if (stored && VALID_THEMES.includes(stored)) {
      return stored;
    }
  } catch {
    // localStorage unavailable
  }
  return "default";
}

function getServerSnapshot(): Theme {
  return "default";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    applyThemeToDocument(theme);
  }, [theme]);

  const setTheme = useCallback((nextTheme: Theme) => {
    if (!VALID_THEMES.includes(nextTheme)) return;

    try {
      localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch {
      // localStorage write failed (e.g. storage quota, private window)
    }

    applyThemeToDocument(nextTheme);
    window.dispatchEvent(new Event("circuitcart-theme-change"));
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, isMounted: true }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
