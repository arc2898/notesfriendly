import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { CalendarOff, Loader2 } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";

type TTGrid = Record<string, Record<string, string>>; // day -> timeIdx -> subject

interface TimetableRow {
  id: string;
  division: string;
  days: string[];
  times: string[];
  grid: TTGrid;
}

const DEFAULT_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];

function parseTimeToMinutes(t: string): number {
  // accepts "9:00", "09:00", "09:00 AM"
  const m = t.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)?/i);
  if (!m) return 0;
  let h = parseInt(m[1], 10);
  const min = m[2] ? parseInt(m[2], 10) : 0;
  const mer = m[3]?.toLowerCase();
  if (mer === "pm" && h < 12) h += 12;
  if (mer === "am" && h === 12) h = 0;
  return h * 60 + min;
}

export function TimetableWidget() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tt, setTt] = useState<TimetableRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!user?.division) return;
    (async () => {
      const { data } = await supabase
        .from("timetables")
        .select("*")
        .eq("division", user.division)
        .maybeSingle();
      if (data) {
        setTt({
          id: data.id,
          division: data.division,
          days: ((data.days as any) || DEFAULT_DAYS) as string[],
          times: ((data.times as any) || []) as string[],
          grid: ((data.grid as any) || {}) as TTGrid,
        });
      }
      setLoading(false);
    })();
  }, [user?.division]);

  const dayNames = useMemo(() => (tt?.days?.length ? tt.days : DEFAULT_DAYS), [tt]);
  const times = useMemo(() => tt?.times || [], [tt]);

  const todayName = useMemo(() => {
    const idx = now.getDay(); // 0 sun
    const map = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return map[idx];
  }, [now]);

  const currentMins = now.getHours() * 60 + now.getMinutes();

  const isCurrentSlot = (day: string, timeStr: string, nextTimeStr?: string) => {
    if (day !== todayName) return false;
    const start = parseTimeToMinutes(timeStr);
    const end = nextTimeStr ? parseTimeToMinutes(nextTimeStr) : start + 60;
    return currentMins >= start && currentMins < end;
  };

  const isUpcoming24h = (day: string, timeStr: string) => {
    // compute date for this slot in current week and check within next 24h
    const dayIdx = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(day);
    if (dayIdx === -1) return false;
    const today = now.getDay();
    let diff = dayIdx - today;
    if (diff < 0) diff += 7;
    const slotDate = new Date(now);
    slotDate.setDate(now.getDate() + diff);
    const m = parseTimeToMinutes(timeStr);
    slotDate.setHours(Math.floor(m / 60), m % 60, 0, 0);
    const ms = slotDate.getTime() - now.getTime();
    return ms > 0 && ms <= 24 * 60 * 60 * 1000;
  };

  if (loading) {
    return (
      <div className="glass rounded-xl p-6 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  if (!tt || !times.length) {
    return (
      <div className="glass rounded-xl">
        <EmptyState
          icon={CalendarOff}
          title="No timetable yet"
          subtitle="Admin will publish the schedule soon"
          className="min-h-[180px]"
        />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          This Week
        </h3>
        <button
          onClick={() => navigate("/timetable")}
          className="text-xs text-primary font-medium hover:underline"
        >
          Full view
        </button>
      </div>
      <div className="glass rounded-xl p-2 overflow-x-auto">
        <div
          className="grid gap-1 min-w-[520px]"
          style={{ gridTemplateColumns: `auto repeat(${dayNames.length}, minmax(72px, 1fr))` }}
        >
          {/* Header row */}
          <div />
          {dayNames.map((d) => (
            <div
              key={d}
              className={`text-[10px] font-bold text-center uppercase tracking-wider py-1 ${
                d === todayName ? "text-primary" : "text-muted-foreground"
              }`}
            >
              {d}
            </div>
          ))}

          {/* Body rows */}
          {times.map((t, ti) => {
            const next = times[ti + 1];
            return (
              <Row key={t}>
                <div className="text-[10px] text-muted-foreground font-mono pr-2 text-right py-1.5">
                  {t}
                </div>
                {dayNames.map((d) => {
                  const subj = tt.grid?.[d]?.[String(ti)] || tt.grid?.[d]?.[t] || "";
                  const cur = isCurrentSlot(d, t, next);
                  const up = !cur && isUpcoming24h(d, t) && subj;
                  return (
                    <button
                      key={d + ti}
                      onClick={() => navigate("/timetable")}
                      className={[
                        "rounded-md p-1 text-xs cursor-pointer transition-colors text-foreground/90",
                        "bg-card hover:bg-card/80 min-h-[36px] truncate",
                        cur ? "bg-accent/20 ring-1 ring-accent" : "",
                        up ? "border-l-4 border-accent" : "",
                        !subj ? "opacity-40" : "",
                      ].join(" ")}
                      title={subj || "—"}
                    >
                      <span className="block truncate">{subj || "—"}</span>
                    </button>
                  );
                })}
              </Row>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
