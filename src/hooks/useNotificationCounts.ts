import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useNotificationCounts() {
  const { user } = useAuth();
  const [chats, setChats] = useState(0);
  const [attendance, setAttendance] = useState(0);

  const refresh = useCallback(async () => {
    if (!user?.supabaseId) return;
    // Unread DMs to me
    const { count: dmCount } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("to_user_id", user.supabaseId)
      .eq("is_read", false)
      .is("deleted_at", null);

    setChats(dmCount || 0);

    // Attendance alert: any subject below threshold
    const [{ data: subj }, { data: recs }] = await Promise.all([
      supabase.from("user_subjects").select("id, threshold").eq("user_id", user.supabaseId),
      supabase.from("attendance_records").select("subject_id, status").eq("user_id", user.supabaseId),
    ]);
    let belowCount = 0;
    if (subj && recs) {
      for (const s of subj as any[]) {
        const subRecs = (recs as any[]).filter((r) => r.subject_id === s.id && r.status !== "cancelled");
        if (subRecs.length === 0) continue;
        const present = subRecs.filter((r) => r.status === "present").length;
        const pct = (present / subRecs.length) * 100;
        if (pct < s.threshold) belowCount++;
      }
    }
    setAttendance(belowCount);
  }, [user?.supabaseId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Realtime: bump on incoming dm or read updates
  useEffect(() => {
    if (!user?.supabaseId) return;
    const channel = supabase
      .channel(`badge-counts-${user.supabaseId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages", filter: `to_user_id=eq.${user.supabaseId}` },
        () => refresh()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "attendance_records", filter: `user_id=eq.${user.supabaseId}` },
        () => refresh()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.supabaseId, refresh]);

  return { chats, attendance, refresh };
}
