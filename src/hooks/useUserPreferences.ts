import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface SavedSearch {
  id: string;
  query: string;
  subjects: string[];
  type: string | null;
  createdAt: string;
}

export interface UserPreferences {
  saved_searches: SavedSearch[];
  muted_users: string[];
  muted_groups: string[];
  muted_subjects: string[];
  career_goal: string | null;
  push_enabled: boolean;
  push_types: string[];
}

const DEFAULT: UserPreferences = {
  saved_searches: [],
  muted_users: [],
  muted_groups: [],
  muted_subjects: [],
  career_goal: null,
  push_enabled: false,
  push_types: ["message", "post_reply", "mention"],
};

export function useUserPreferences() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<UserPreferences>(DEFAULT);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    if (!user?.supabaseId) return;
    (async () => {
      const { data } = await supabase
        .from("user_preferences")
        .select("*")
        .eq("user_id", user.supabaseId!)
        .maybeSingle();
      if (!active) return;
      if (data) {
        const d = data as any;
        setPrefs({
          saved_searches: (d.saved_searches as SavedSearch[]) || [],
          muted_users: (d.muted_users as string[]) || [],
          muted_groups: (d.muted_groups as string[]) || [],
          muted_subjects: (d.muted_subjects as string[]) || [],
          career_goal: (d.career_goal as string | null) ?? null,
          push_enabled: !!d.push_enabled,
          push_types: (d.push_types as string[]) || DEFAULT.push_types,
        });
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [user?.supabaseId]);

  const update = useCallback(
    async (patch: Partial<UserPreferences>) => {
      if (!user?.supabaseId) return;
      const next = { ...prefs, ...patch };
      setPrefs(next);
      await supabase.from("user_preferences").upsert({
        user_id: user.supabaseId,
        saved_searches: next.saved_searches as any,
        muted_users: next.muted_users as any,
        muted_groups: next.muted_groups as any,
        muted_subjects: next.muted_subjects as any,
        career_goal: next.career_goal,
        push_enabled: next.push_enabled,
        push_types: next.push_types as any,
        updated_at: new Date().toISOString(),
      } as any);
    },
    [prefs, user?.supabaseId]
  );

  const toggleMuteUser = useCallback(
    (id: string) => {
      const list = prefs.muted_users.includes(id)
        ? prefs.muted_users.filter((x) => x !== id)
        : [...prefs.muted_users, id];
      return update({ muted_users: list });
    },
    [prefs.muted_users, update]
  );

  const saveSearch = useCallback(
    (s: Omit<SavedSearch, "id" | "createdAt">) => {
      const item: SavedSearch = {
        ...s,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
      };
      return update({ saved_searches: [item, ...prefs.saved_searches].slice(0, 20) });
    },
    [prefs.saved_searches, update]
  );

  const removeSavedSearch = useCallback(
    (id: string) => update({ saved_searches: prefs.saved_searches.filter((s) => s.id !== id) }),
    [prefs.saved_searches, update]
  );

  return { prefs, loading, update, toggleMuteUser, saveSearch, removeSavedSearch };
}
