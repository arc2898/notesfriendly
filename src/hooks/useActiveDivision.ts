import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import type { Division } from "@/lib/constants";

const STORAGE_KEY = "god_active_division";

export function readGodDivision(): Division | null {
  if (typeof window === "undefined") return null;
  const v = localStorage.getItem(STORAGE_KEY);
  return v === "CS" || v === "BS" || v === "IT" ? v : null;
}

export function writeGodDivision(div: Division | null) {
  if (typeof window === "undefined") return;
  if (div) localStorage.setItem(STORAGE_KEY, div);
  else localStorage.removeItem(STORAGE_KEY);
}

/**
 * Active viewing division.
 * - URL path `/cs`, `/bs`, `/it` wins.
 * - Otherwise god uses their stored selection (or null = not chosen).
 * - Otherwise student's own division.
 */
export function useActiveDivision(): { division: Division | null; isGod: boolean } {
  const { user } = useAuth();
  const { pathname } = useLocation();

  const seg = pathname.split("/").filter(Boolean)[0]?.toLowerCase();
  let urlDiv: Division | null = null;
  if (seg === "cs") urlDiv = "CS";
  else if (seg === "bs") urlDiv = "BS";
  else if (seg === "it") urlDiv = "IT";

  const isGod = user?.role === "god";

  if (urlDiv) return { division: urlDiv, isGod };
  if (isGod) return { division: readGodDivision(), isGod };
  return { division: (user?.division as Division) || null, isGod };
}
