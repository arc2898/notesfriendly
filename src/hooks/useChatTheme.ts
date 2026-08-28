import { useEffect, useState, useCallback } from "react";

export type BubbleShape = "rounded" | "square" | "minimal";

export type WallpaperKind = "preset" | "color" | "custom";

export interface WallpaperPreset {
  id: string;
  name: string;
  /** CSS background value (gradient or url) */
  value: string;
  /** Optional dark-mode override */
  darkValue?: string;
}

export const WALLPAPER_PRESETS: WallpaperPreset[] = [
  { id: "default", name: "Default", value: "hsl(var(--background))" },
  {
    id: "aurora",
    name: "Aurora",
    value:
      "linear-gradient(135deg, hsl(170 60% 92%) 0%, hsl(200 70% 94%) 50%, hsl(280 50% 95%) 100%)",
    darkValue:
      "linear-gradient(135deg, hsl(170 30% 12%) 0%, hsl(220 35% 14%) 50%, hsl(280 30% 16%) 100%)",
  },
  {
    id: "sunset",
    name: "Sunset",
    value:
      "linear-gradient(135deg, hsl(20 90% 92%) 0%, hsl(340 80% 94%) 50%, hsl(280 70% 95%) 100%)",
    darkValue:
      "linear-gradient(135deg, hsl(20 40% 14%) 0%, hsl(340 35% 14%) 50%, hsl(280 30% 16%) 100%)",
  },
  {
    id: "mint",
    name: "Mint",
    value:
      "linear-gradient(180deg, hsl(155 50% 95%) 0%, hsl(180 55% 96%) 100%)",
    darkValue:
      "linear-gradient(180deg, hsl(155 25% 12%) 0%, hsl(180 30% 14%) 100%)",
  },
  {
    id: "lavender",
    name: "Lavender",
    value: "linear-gradient(180deg, hsl(260 50% 96%) 0%, hsl(220 60% 96%) 100%)",
    darkValue:
      "linear-gradient(180deg, hsl(260 25% 13%) 0%, hsl(220 30% 14%) 100%)",
  },
  {
    id: "paper",
    name: "Paper",
    value:
      "radial-gradient(circle at 1px 1px, hsl(0 0% 80% / 0.5) 1px, transparent 0) 0 0 / 16px 16px, hsl(40 30% 97%)",
    darkValue:
      "radial-gradient(circle at 1px 1px, hsl(0 0% 35% / 0.4) 1px, transparent 0) 0 0 / 16px 16px, hsl(0 0% 11%)",
  },
  {
    id: "doodles",
    name: "Doodles",
    value:
      "radial-gradient(hsl(161 50% 70% / 0.18) 2px, transparent 2px) 0 0 / 28px 28px, hsl(0 0% 98%)",
    darkValue:
      "radial-gradient(hsl(161 50% 50% / 0.18) 2px, transparent 2px) 0 0 / 28px 28px, hsl(0 0% 11%)",
  },
];

export const SOLID_COLORS: { id: string; name: string; hsl: string }[] = [
  { id: "white", name: "White", hsl: "0 0% 100%" },
  { id: "cream", name: "Cream", hsl: "40 35% 96%" },
  { id: "sky", name: "Sky", hsl: "200 70% 94%" },
  { id: "rose", name: "Rose", hsl: "340 70% 95%" },
  { id: "sage", name: "Sage", hsl: "150 30% 92%" },
  { id: "graphite", name: "Graphite", hsl: "220 15% 18%" },
  { id: "midnight", name: "Midnight", hsl: "230 35% 12%" },
  { id: "forest", name: "Forest", hsl: "160 30% 14%" },
];

export interface ChatTheme {
  wallpaperKind: WallpaperKind;
  wallpaperId: string;
  /** Public URL for kind === "custom" */
  customUrl?: string;
  bubbleShape: BubbleShape;
}

const DEFAULT_THEME: ChatTheme = {
  wallpaperKind: "preset",
  wallpaperId: "default",
  bubbleShape: "rounded",
};

const STORAGE_KEY = "nf:chat-theme:v1";
const EVENT = "nf:chat-theme:update";

function readStored(): ChatTheme {
  if (typeof window === "undefined") return DEFAULT_THEME;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_THEME;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_THEME, ...parsed };
  } catch {
    return DEFAULT_THEME;
  }
}

export function useChatTheme() {
  const [theme, setThemeState] = useState<ChatTheme>(() => readStored());

  useEffect(() => {
    const sync = () => setThemeState(readStored());
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const setTheme = useCallback((patch: Partial<ChatTheme>) => {
    const next = { ...readStored(), ...patch };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(EVENT));
    setThemeState(next);
  }, []);

  const reset = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event(EVENT));
    setThemeState(DEFAULT_THEME);
  }, []);

  return { theme, setTheme, reset };
}

/** Resolve the current wallpaper to a CSS background value. */
export function resolveWallpaperBackground(theme: ChatTheme, isDark: boolean): string {
  if (theme.wallpaperKind === "custom" && theme.customUrl) {
    return `center / cover no-repeat url("${theme.customUrl}")`;
  }
  if (theme.wallpaperKind === "color") {
    const color = SOLID_COLORS.find((c) => c.id === theme.wallpaperId);
    return color ? `hsl(${color.hsl})` : "hsl(var(--background))";
  }
  const preset = WALLPAPER_PRESETS.find((p) => p.id === theme.wallpaperId) || WALLPAPER_PRESETS[0];
  return isDark && preset.darkValue ? preset.darkValue : preset.value;
}

/** Tailwind-ish class fragments for bubble shape. */
export function bubbleShapeClasses(shape: BubbleShape, isMe: boolean, isLastInGroup: boolean): string {
  switch (shape) {
    case "square":
      return "rounded-md";
    case "minimal":
      return isMe
        ? `rounded-2xl ${isLastInGroup ? "rounded-br-sm" : ""}`
        : `rounded-2xl ${isLastInGroup ? "rounded-bl-sm" : ""}`;
    case "rounded":
    default:
      return isMe
        ? `rounded-2xl ${isLastInGroup ? "rounded-br-md" : ""}`
        : `rounded-2xl ${isLastInGroup ? "rounded-bl-md" : ""}`;
  }
}
