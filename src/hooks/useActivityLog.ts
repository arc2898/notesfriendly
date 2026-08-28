import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useActivityLog() {
  const { user } = useAuth();

  const log = useCallback(
    async (action: string, details?: string, page?: string) => {
      if (!user?.supabaseId) return;
      try {
        await supabase.from("activity_logs").insert({
          user_id: user.supabaseId,
          action,
          details: details || null,
          page: page || window.location.pathname,
        });
      } catch {
        // silent fail – logging should never block UX
      }
    },
    [user?.supabaseId]
  );

  return { log };
}
