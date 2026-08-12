"use client";

import { Theme } from "@/types/pdf";
import { useEffect, useState } from "react";

export function useTheme() {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const toggle_theme = () => {
    setTheme((current: string) => (current == "dark" ? "light" : "dark"));
  };

  return {
    theme,
    toggle_theme,
    isDark: theme === "dark",
  };
}
