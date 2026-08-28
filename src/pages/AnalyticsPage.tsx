import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { Loader2, Users, MessageSquare, FileText, HardDrive, TrendingUp } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, BarChart, Bar } from "recharts";
import { toast } from "sonner";

interface Summary {
  active_users: { d1: number; d7: number; d30: number };
  daily_messages: { day: string; n: number }[];
  top_posters: { name: string; n: number }[];
  storage_by_subject: { subject: string; bytes: number; files: number }[];
  totals: { users: number; messages: number; posts: number; files: number };
}

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`;
  return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export default function AnalyticsPage() {
  const { user } = useAuth();
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || (user.role !== "god" && user.role !== "admin")) return;
    (async () => {
      const { data, error } = await supabase.rpc("analytics_summary" as any);
      if (error) {
        toast.error(error.message);
      } else {
        // Normalise to avoid undefined access in charts/lists
        const d = (data || {}) as Partial<Summary>;
        setData({
          active_users: d.active_users ?? { d1: 0, d7: 0, d30: 0 },
          daily_messages: d.daily_messages ?? [],
          top_posters: d.top_posters ?? [],
          storage_by_subject: d.storage_by_subject ?? [],
          totals: d.totals ?? { users: 0, messages: 0, posts: 0, files: 0 },
        });
      }
      setLoading(false);
    })();
  }, [user]);

  if (user && user.role !== "god" && user.role !== "admin") {
    return <Navigate to="/" replace />;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!data) {
    return <div className="p-4 text-sm text-muted-foreground">No data available.</div>;
  }

  const stats = [
    { label: "Total users", value: data.totals.users, icon: Users },
    { label: "Messages", value: data.totals.messages, icon: MessageSquare },
    { label: "Posts", value: data.totals.posts, icon: FileText },
    { label: "Files", value: data.totals.files, icon: HardDrive },
  ];

  return (
    <div className="p-4 max-w-5xl mx-auto space-y-5 fade-in">
      <div className="space-y-1">
        <h2 className="text-2xl font-bold text-foreground">Analytics</h2>
        <p className="text-sm text-muted-foreground">Activity across NotesFriendly</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="glass rounded-xl p-3">
            <s.icon className="h-4 w-4 text-primary mb-1.5" />
            <p className="text-2xl font-bold text-foreground">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="glass rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Active users</h3>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-2xl font-bold text-foreground">{data.active_users.d1}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">24h</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{data.active_users.d7}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">7d</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{data.active_users.d30}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">30d</p>
          </div>
        </div>
      </div>

      <div className="glass rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Daily messages (30d)</h3>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.daily_messages}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} hide />
              <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip
                contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                labelStyle={{ color: "hsl(var(--foreground))" }}
              />
              <Line type="monotone" dataKey="n" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="glass rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Top posters</h3>
          {data.top_posters.length === 0 ? (
            <p className="text-xs text-muted-foreground">No data yet.</p>
          ) : (
            <div className="space-y-2">
              {data.top_posters.map((p, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-foreground truncate">{p.name || "Unknown"}</span>
                  <span className="font-bold text-primary">{p.n}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="glass rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Storage by subject</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.storage_by_subject}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="subject" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={formatBytes} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                  formatter={(v: number) => formatBytes(v)}
                />
                <Bar dataKey="bytes" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
