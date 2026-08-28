import { useState, useEffect } from "react";
import { Bell, X, MessageCircle, Check, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  is_read: boolean;
  created_at: string;
  related_user_id: string | null;
}

export function NotificationsPopup() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const fetchNotifications = async () => {
    if (!user?.supabaseId) return;
    setLoading(true);
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.supabaseId)
      .order("created_at", { ascending: false })
      .limit(30);
    if (data) setNotifications(data as Notification[]);
    setLoading(false);
  };

  useEffect(() => {
    if (user?.supabaseId) fetchNotifications();
  }, [user?.supabaseId]);

  // Realtime
  useEffect(() => {
    if (!user?.supabaseId) return;
    const channel = supabase.channel(`notifications-popup-${user.supabaseId}-${crypto.randomUUID()}`);
    channel.on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.supabaseId}` },
      (payload) => {
        setNotifications((prev) => [payload.new as Notification, ...prev]);
      }
    );
    channel.subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.supabaseId]);

  const markAllRead = async () => {
    if (!user?.supabaseId) return;
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.supabaseId)
      .eq("is_read", false);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const markRead = async (id: string) => {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n));
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "message": return <MessageCircle className="h-4 w-4 text-primary" />;
      default: return <Bell className="h-4 w-4 text-primary" />;
    }
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "now";
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return `${Math.floor(hrs / 24)}d`;
  };

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="icon"
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
        className="h-12 w-12 rounded-xl glass border-border/50 hover:border-primary/50 hover:bg-primary/5 transition-all relative"
        onClick={() => { setOpen(!open); if (!open) fetchNotifications(); }}
      >
        <Bell className="h-4 w-4 text-muted-foreground" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 h-5 w-5 bg-primary rounded-full text-[10px] font-bold text-primary-foreground flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          
          {/* Popup */}
          <div className="absolute right-0 top-14 w-80 max-h-[70vh] z-50 rounded-xl border border-border/50 bg-background shadow-2xl overflow-hidden">
            <div className="p-3 border-b border-border/30 flex items-center justify-between">
              <h3 className="font-bold text-sm text-foreground">Notifications</h3>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={markAllRead} className="text-xs text-primary h-7">
                    <CheckCheck className="h-3 w-3 mr-1" /> Read all
                  </Button>
                )}
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(false)} aria-label="Close notifications">
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <div className="overflow-y-auto max-h-[calc(70vh-3rem)]">
              {loading && notifications.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">Loading...</div>
              ) : notifications.length === 0 ? (
                <div className="p-8 text-center">
                  <Bell className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No notifications yet</p>
                </div>
              ) : (
                notifications.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => { if (!n.is_read) markRead(n.id); }}
                    className={`w-full text-left p-3 flex gap-3 hover:bg-accent/30 transition-colors border-b border-border/20 ${
                      !n.is_read ? "bg-primary/5" : ""
                    }`}
                  >
                    <div className="shrink-0 mt-0.5">{getIcon(n.type)}</div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${!n.is_read ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                        {n.title}
                      </p>
                      {n.body && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{n.body}</p>
                      )}
                      <p className="text-[10px] text-muted-foreground/60 mt-1">{timeAgo(n.created_at)}</p>
                    </div>
                    {!n.is_read && (
                      <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1.5" />
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
