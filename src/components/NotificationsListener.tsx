import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useLocation, useNavigate } from "react-router-dom";
import { useUserPreferences } from "@/hooks/useUserPreferences";

/**
 * Subscribes to inserts on the user's notifications row. Surfaces a toast
 * (unless already on Chats), and — if the user enabled push and has granted
 * Notifications permission — also fires an OS-level notification via the
 * service worker (production) or the Notification API (fallback).
 */
export default function NotificationsListener() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { prefs } = useUserPreferences();

  useEffect(() => {
    if (!user?.supabaseId) return;
    const channel = supabase
      .channel(`notif-toast-${user.supabaseId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.supabaseId}`,
        },
        async (payload) => {
          const n = payload.new as { type: string; title: string; body: string | null };

          // OS notification (only when document hidden + permission granted + opted in)
          const allowed =
            prefs.push_enabled &&
            prefs.push_types.includes(n.type) &&
            typeof Notification !== "undefined" &&
            Notification.permission === "granted" &&
            document.visibilityState !== "visible";

          if (allowed) {
            try {
              const reg = await navigator.serviceWorker?.ready;
              const url =
                n.type === "message" || n.type === "group_message"
                  ? "/chats"
                  : "/";
              const opts: NotificationOptions = {
                body: n.body || undefined,
                icon: "/icon-192.png",
                badge: "/icon-192.png",
                tag: n.type,
                data: { url },
              };
              if (reg) await reg.showNotification(n.title, opts);
              else new Notification(n.title, opts);
            } catch { /* ignore */ }
          }

          // Skip in-app toast if user is already viewing chats
          if (location.pathname.startsWith("/chats")) return;
          toast(n.title, {
            description: n.body || undefined,
            action: n.type === "message" || n.type === "group_message"
              ? { label: "Open", onClick: () => navigate("/chats") }
              : undefined,
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.supabaseId, location.pathname, navigate, prefs.push_enabled, prefs.push_types]);

  return null;
}
