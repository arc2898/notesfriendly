import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface MessageReactionRow {
  id: string;
  message_id: string;
  user_id: string;
  reaction: string;
  created_at: string;
}

export const REACTION_TYPES = ["thumbs_up", "thumbs_down", "heart", "flame", "star", "laugh"] as const;
export type ReactionType = typeof REACTION_TYPES[number];

export function useMessageReactions(messageIds: string[]) {
  const { user } = useAuth();
  const [rows, setRows] = useState<MessageReactionRow[]>([]);

  // Load
  useEffect(() => {
    if (messageIds.length === 0) { setRows([]); return; }
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("message_reactions")
        .select("*")
        .in("message_id", messageIds);
      if (active && data) setRows(data as MessageReactionRow[]);
    })();
    return () => { active = false; };
  }, [messageIds.join(",")]);

  // Realtime
  useEffect(() => {
    if (messageIds.length === 0) return;
    const channel = supabase
      .channel(`reactions-${messageIds[0]}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "message_reactions" }, (payload) => {
        if (payload.eventType === "INSERT") {
          const r = payload.new as MessageReactionRow;
          if (!messageIds.includes(r.message_id)) return;
          setRows((p) => p.some((x) => x.id === r.id) ? p : [...p, r]);
        } else if (payload.eventType === "DELETE") {
          const r = payload.old as MessageReactionRow;
          setRows((p) => p.filter((x) => x.id !== r.id));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [messageIds.join(",")]);

  const byMessage = useMemo(() => {
    const map: Record<string, MessageReactionRow[]> = {};
    rows.forEach((r) => {
      if (!map[r.message_id]) map[r.message_id] = [];
      map[r.message_id].push(r);
    });
    return map;
  }, [rows]);

  const toggle = useCallback(async (messageId: string, reaction: ReactionType) => {
    if (!user?.supabaseId) return;
    const existing = rows.find(
      (r) => r.message_id === messageId && r.user_id === user.supabaseId && r.reaction === reaction
    );
    if (existing) {
      setRows((p) => p.filter((x) => x.id !== existing.id));
      const { error } = await supabase.from("message_reactions").delete().eq("id", existing.id);
      if (error) setRows((p) => [...p, existing]);
    } else {
      const optimistic: MessageReactionRow = {
        id: `temp-${Date.now()}`,
        message_id: messageId,
        user_id: user.supabaseId,
        reaction,
        created_at: new Date().toISOString(),
      };
      setRows((p) => [...p, optimistic]);
      const { data, error } = await supabase
        .from("message_reactions")
        .insert({ message_id: messageId, user_id: user.supabaseId, reaction })
        .select().single();
      if (error) {
        setRows((p) => p.filter((x) => x.id !== optimistic.id));
      } else if (data) {
        setRows((p) => p.map((x) => x.id === optimistic.id ? (data as MessageReactionRow) : x));
      }
    }
  }, [rows, user?.supabaseId]);

  return { byMessage, toggle };
}
