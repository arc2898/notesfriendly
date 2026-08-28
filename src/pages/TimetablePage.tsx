import { ArrowLeft, Pencil, Plus, Save, Trash2, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Division = "CS" | "BS" | "IT";

interface Timetable {
  division: Division;
  days: string[];
  times: string[];
  grid: Record<string, string[]>;
  updated_at: string;
}

const DEFAULTS: Record<Division, Omit<Timetable, "updated_at">> = {
  CS: {
    division: "CS",
    days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    times: ["9:00-9:50", "9:50-10:40", "10:55-11:45", "11:45-12:35", "1:30-2:20", "2:20-3:10", "3:10-4:10"],
    grid: {
      Monday: ["DS", "EP", "BEEE", "DEVC", "", "EPL/ITWS", ""],
      Tuesday: ["BEEE", "COUN", "DEVC", "NNSCS", "", "DSL/EEEWS", ""],
      Wednesday: ["EP", "", "EG", "", "DEVC", "DS", "BEEE"],
      Thursday: ["EP", "DS", "", "EG", "DEVC", "SS", ""],
      Friday: ["DS", "", "ITWS/EPL", "", "DEVC", "BEEE", "EP"],
      Saturday: ["DEVC", "", "EEEWS/DSL", "", "EP", "BEEE", "DS"],
    },
  },
  BS: {
    division: "BS",
    days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    times: ["9:00-9:50", "9:50-10:40", "10:55-11:45", "11:45-12:35", "1:30-2:20", "2:20-3:10", "3:10-4:10"],
    grid: {
      Monday: ["DS", "DS", "DEVC", "EP", "BEEE", "EG", "EG"],
      Tuesday: ["EP", "EPL/ITWS", "EPL/ITWS", "", "DEVC", "BEEE", "DS"],
      Wednesday: ["DEVC", "EP", "SS", "SS", "DSL/EEEWS", "DSL/EEEWS", ""],
      Thursday: ["NNSCS", "BEEE", "DEVC", "EP", "ITWS/EPL", "ITWS/EPL", ""],
      Friday: ["BEEE", "", "EEEWS/DSL", "EEEWS/DSL", "DEVC", "EP", "DS"],
      Saturday: ["BEEE", "DEVC", "COUN", "DS", "EG", "", ""],
    },
  },
  IT: {
    division: "IT",
    days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    times: ["9:00-9:50", "9:50-10:40", "10:55-11:45", "11:45-12:35", "1:30-2:20", "2:20-3:10", "3:10-4:10"],
    grid: {
      Monday: ["", "", "", "", "", "", ""],
      Tuesday: ["", "", "", "", "", "", ""],
      Wednesday: ["", "", "", "", "", "", ""],
      Thursday: ["", "", "", "", "", "", ""],
      Friday: ["", "", "", "", "", "", ""],
      Saturday: ["", "", "", "", "", "", ""],
    },
  },
};

function ViewGrid({ tt }: { tt: Timetable }) {
  const idxByTime = useMemo(() => {
    const m: Record<number, string> = {};
    tt.times.forEach((t, i) => (m[i] = t));
    return m;
  }, [tt.times]);

  return (
    <div className="space-y-3">
      {tt.days.map((day) => {
        const periods = tt.grid[day] || [];
        const filled = periods.map((s, i) => ({ subject: s, time: idxByTime[i] || "" })).filter((p) => p.subject);
        if (filled.length === 0) return null;
        return (
          <div key={day} className="glass rounded-xl p-3 space-y-2">
            <p className="text-sm font-bold text-primary">{day}</p>
            <div className="grid grid-cols-4 gap-1.5">
              {filled.map((p, i) => (
                <div key={i} className="rounded-lg bg-primary/10 p-2 text-center">
                  <p className="text-xs font-bold text-foreground">{p.subject}</p>
                  <p className="text-[9px] text-muted-foreground">{p.time}</p>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EditGrid({
  tt,
  onChange,
}: {
  tt: Timetable;
  onChange: (next: Timetable) => void;
}) {
  const updateCell = (day: string, idx: number, value: string) => {
    const nextGrid = { ...tt.grid, [day]: [...(tt.grid[day] || [])] };
    nextGrid[day][idx] = value;
    onChange({ ...tt, grid: nextGrid });
  };

  const updateTime = (idx: number, value: string) => {
    const times = [...tt.times];
    times[idx] = value;
    onChange({ ...tt, times });
  };

  const addPeriod = () => {
    const times = [...tt.times, ""];
    const grid: Record<string, string[]> = {};
    tt.days.forEach((d) => {
      grid[d] = [...(tt.grid[d] || []), ""];
    });
    onChange({ ...tt, times, grid });
  };

  const removePeriod = (idx: number) => {
    const times = tt.times.filter((_, i) => i !== idx);
    const grid: Record<string, string[]> = {};
    tt.days.forEach((d) => {
      grid[d] = (tt.grid[d] || []).filter((_, i) => i !== idx);
    });
    onChange({ ...tt, times, grid });
  };

  const addDay = () => {
    const name = window.prompt("New day name (e.g. Sunday)")?.trim();
    if (!name) return;
    if (tt.days.includes(name)) {
      toast.error("Day already exists");
      return;
    }
    const days = [...tt.days, name];
    const grid = { ...tt.grid, [name]: tt.times.map(() => "") };
    onChange({ ...tt, days, grid });
  };

  const removeDay = (day: string) => {
    if (!confirm(`Remove ${day}?`)) return;
    const days = tt.days.filter((d) => d !== day);
    const grid = { ...tt.grid };
    delete grid[day];
    onChange({ ...tt, days, grid });
  };

  return (
    <div className="space-y-4">
      <div className="glass rounded-xl p-3 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-foreground">Period times</p>
          <Button variant="outline" size="sm" onClick={addPeriod} className="h-7 px-2 text-xs">
            <Plus className="h-3 w-3 mr-1" /> Period
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {tt.times.map((t, i) => (
            <div key={i} className="flex items-center gap-1">
              <Input
                value={t}
                onChange={(e) => updateTime(i, e.target.value)}
                placeholder="9:00-9:50"
                className="h-8 text-xs"
              />
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => removePeriod(i)} aria-label="Remove period">
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      {tt.days.map((day) => (
        <div key={day} className="glass rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-primary">{day}</p>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeDay(day)} aria-label={`Remove ${day}`}>
              <X className="h-4 w-4 text-destructive" />
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {tt.times.map((t, i) => (
              <div key={i} className="rounded-lg bg-primary/5 p-1.5 space-y-1">
                <p className="text-[9px] text-muted-foreground text-center">{t || `P${i + 1}`}</p>
                <Input
                  value={tt.grid[day]?.[i] || ""}
                  onChange={(e) => updateCell(day, i, e.target.value)}
                  placeholder="—"
                  className="h-7 text-xs text-center font-bold"
                />
              </div>
            ))}
          </div>
        </div>
      ))}

      <Button variant="outline" onClick={addDay} className="w-full">
        <Plus className="h-4 w-4 mr-1" /> Add day
      </Button>
    </div>
  );
}

export default function TimetablePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canEdit = user?.role === "admin" || user?.role === "god";

  const [tab, setTab] = useState<Division>(((["CS","BS","IT"] as Division[]).includes(user?.division as Division) ? (user!.division as Division) : "CS"));
  const [tables, setTables] = useState<Record<Division, Timetable | null>>({ CS: null, BS: null, IT: null });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Timetable | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Initial fetch
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from("timetables").select("*");
      if (error) {
        toast.error("Failed to load timetable");
        setLoading(false);
        return;
      }
      const next: Record<Division, Timetable | null> = { CS: null, BS: null, IT: null };
      (data || []).forEach((row: any) => {
        if (row.division === "CS" || row.division === "BS" || row.division === "IT") {
          next[row.division as Division] = {
            division: row.division,
            days: row.days || [],
            times: row.times || [],
            grid: row.grid || {},
            updated_at: row.updated_at,
          };
        }
      });
      setTables(next);
      setLoading(false);
    })();
  }, []);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("timetables-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "timetables" },
        (payload: any) => {
          const row = payload.new || payload.old;
          if (!row?.division) return;
          if (payload.eventType === "DELETE") {
            setTables((prev) => ({ ...prev, [row.division as Division]: null }));
            return;
          }
          setTables((prev) => ({
            ...prev,
            [row.division as Division]: {
              division: row.division,
              days: row.days || [],
              times: row.times || [],
              grid: row.grid || {},
              updated_at: row.updated_at,
            },
          }));
          // If we're not the editor, show a subtle hint
          if (!editing) {
            toast.message(`${row.division} timetable updated`);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  const current = tables[tab] || (DEFAULTS[tab] as Timetable);

  const startEdit = () => {
    setDraft(JSON.parse(JSON.stringify(current)));
    setEditing(true);
  };

  const cancelEdit = () => {
    setDraft(null);
    setEditing(false);
  };

  const save = async () => {
    if (!draft || !user?.supabaseId) return;
    setSaving(true);
    const { error } = await supabase
      .from("timetables")
      .upsert(
        {
          division: draft.division,
          days: draft.days,
          times: draft.times,
          grid: draft.grid,
          updated_by: user.supabaseId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "division" }
      );
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Timetable updated");
    setEditing(false);
    setDraft(null);
  };

  const resetToDefault = () => {
    if (!confirm(`Reset ${tab} to default timetable?`)) return;
    const def = DEFAULTS[tab];
    setDraft({ ...def, updated_at: new Date().toISOString() } as Timetable);
  };

  return (
    <div className="p-4 space-y-4 fade-in max-w-lg mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="shrink-0" aria-label="Back to home">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h2 className="text-lg font-bold text-foreground">Timetable</h2>
          <p className="text-xs text-muted-foreground">B.Tech II Sem &middot; A.Y. 2025-26</p>
        </div>
        {canEdit && !editing && (
          <Button size="sm" variant="outline" onClick={startEdit}>
            <Pencil className="h-4 w-4 mr-1" /> Edit
          </Button>
        )}
        {canEdit && editing && (
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" onClick={cancelEdit}>
              <X className="h-4 w-4" />
            </Button>
            <Button size="sm" onClick={save} disabled={saving}>
              <Save className="h-4 w-4 mr-1" /> {saving ? "Saving" : "Save"}
            </Button>
          </div>
        )}
      </div>

      <Tabs value={tab} onValueChange={(v) => { if (editing) return; setTab(v as Division); }}>
        <TabsList className="grid grid-cols-2 w-full">
          <TabsTrigger value="CS" disabled={editing && draft?.division !== "CS"}>CS</TabsTrigger>
          <TabsTrigger value="BS" disabled={editing && draft?.division !== "BS"}>BS</TabsTrigger>
          <TabsTrigger value="IT" disabled={editing && draft?.division !== "IT"}>IT</TabsTrigger>
        </TabsList>

        <div className="text-[10px] text-muted-foreground text-center mt-3">
          Lunch Break: 12:35 PM – 1:30 PM
        </div>

        {editing && draft && (
          <div className="mt-3 flex justify-end">
            <Button variant="outline" size="sm" onClick={resetToDefault}>
              <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset to default
            </Button>
          </div>
        )}

        <TabsContent value="CS" className="mt-3">
          {loading ? (
            <div className="text-center text-xs text-muted-foreground py-8">Loading…</div>
          ) : editing && draft?.division === "CS" ? (
            <EditGrid tt={draft} onChange={setDraft} />
          ) : (
            <ViewGrid tt={tables.CS || (DEFAULTS.CS as Timetable)} />
          )}
        </TabsContent>
        <TabsContent value="BS" className="mt-3">
          {loading ? (
            <div className="text-center text-xs text-muted-foreground py-8">Loading…</div>
          ) : editing && draft?.division === "BS" ? (
            <EditGrid tt={draft} onChange={setDraft} />
          ) : (
            <ViewGrid tt={tables.BS || (DEFAULTS.BS as Timetable)} />
          )}
        </TabsContent>
        <TabsContent value="IT" className="mt-3">
          {loading ? (
            <div className="text-center text-xs text-muted-foreground py-8">Loading…</div>
          ) : editing && draft?.division === "IT" ? (
            <EditGrid tt={draft} onChange={setDraft} />
          ) : (
            <ViewGrid tt={tables.IT || (DEFAULTS.IT as Timetable)} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
