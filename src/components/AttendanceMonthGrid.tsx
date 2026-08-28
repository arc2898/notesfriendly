import { useMemo, useState } from "react";
import { addMonths, eachDayOfInterval, endOfMonth, format, isSameDay, isToday, startOfMonth, startOfWeek, endOfWeek } from "date-fns";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Record {
  date: string;
  status: "present" | "absent" | "cancelled";
}

interface Props {
  records: Record[];
  onSelectDate: (d: Date) => void;
  selectedDate: Date;
}

function dayClass(records: Record[], d: Date) {
  const ds = format(d, "yyyy-MM-dd");
  const recs = records.filter((r) => r.date === ds);
  if (recs.length === 0) return "";
  const present = recs.filter((r) => r.status === "present").length;
  const absent = recs.filter((r) => r.status === "absent").length;
  if (absent === 0 && present > 0) return "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300";
  if (present === 0 && absent > 0) return "bg-rose-500/20 text-rose-700 dark:text-rose-300";
  return "bg-amber-500/20 text-amber-700 dark:text-amber-300";
}

export default function AttendanceMonthGrid({ records, onSelectDate, selectedDate }: Props) {
  const [cursor, setCursor] = useState(startOfMonth(new Date()));

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [cursor]);

  return (
    <div className="glass rounded-xl p-3 space-y-3">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCursor((c) => addMonths(c, -1))} aria-label="Previous month">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <p className="text-sm font-bold text-foreground">{format(cursor, "MMMM yyyy")}</p>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCursor((c) => addMonths(c, 1))} aria-label="Next month">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-[10px] text-muted-foreground font-semibold text-center">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => <div key={i}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((d) => {
          const inMonth = d.getMonth() === cursor.getMonth();
          const sel = isSameDay(d, selectedDate);
          const today = isToday(d);
          const cls = dayClass(records, d);
          return (
            <button
              key={d.toISOString()}
              onClick={() => onSelectDate(d)}
              className={`aspect-square rounded-md text-xs flex items-center justify-center transition-colors hover:bg-muted ${
                inMonth ? "" : "opacity-30"
              } ${cls} ${sel ? "ring-2 ring-primary" : ""} ${today && !sel ? "ring-1 ring-primary/40" : ""}`}
            >
              {format(d, "d")}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground pt-1">
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500/60" /> Present</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-500/60" /> Absent</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500/60" /> Mixed</span>
      </div>
    </div>
  );
}
