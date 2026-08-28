import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface Bookmark {
  id: string;
  user_id: string;
  subject_code: string;
  folder_type: string;
  file_name: string;
  file_path: string;
  created_at: string;
}

export function useBookmarks() {
  const { user } = useAuth();
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user?.supabaseId) return;
    const { data } = await supabase
      .from("user_bookmarks")
      .select("*")
      .eq("user_id", user.supabaseId)
      .order("created_at", { ascending: false });
    if (data) setBookmarks(data as Bookmark[]);
    setLoading(false);
  }, [user?.supabaseId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const isBookmarked = useCallback(
    (filePath: string) => bookmarks.some((b) => b.file_path === filePath),
    [bookmarks]
  );

  const toggle = useCallback(
    async (file: { subject_code: string; folder_type: string; file_name: string; file_path: string }) => {
      if (!user?.supabaseId) return;
      const existing = bookmarks.find((b) => b.file_path === file.file_path);
      if (existing) {
        setBookmarks((p) => p.filter((b) => b.id !== existing.id));
        const { error } = await supabase.from("user_bookmarks").delete().eq("id", existing.id);
        if (error) {
          toast.error("Failed to remove bookmark");
          refresh();
        }
      } else {
        const { data, error } = await supabase
          .from("user_bookmarks")
          .insert({
            user_id: user.supabaseId,
            subject_code: file.subject_code,
            folder_type: file.folder_type || "other",
            file_name: file.file_name,
            file_path: file.file_path,
          })
          .select()
          .single();
        if (error) {
          toast.error("Failed to bookmark");
        } else if (data) {
          setBookmarks((p) => [data as Bookmark, ...p]);
        }
      }
    },
    [bookmarks, user?.supabaseId, refresh]
  );

  return { bookmarks, loading, isBookmarked, toggle, refresh };
}
