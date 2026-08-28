import { motion } from "framer-motion";

interface Props {
  code: string;
  name: string;
  pct: number;
  threshold: number;
  present: number;
  total: number;
}

export default function SubjectComplianceRing({ code, pct, threshold, present, total }: Props) {
  const radius = 28;
  const circ = 2 * Math.PI * radius;
  const safe = pct >= threshold;
  const stroke = safe ? "hsl(var(--primary))" : pct >= 60 ? "rgb(245 158 11)" : "rgb(244 63 94)";
  const offset = circ - (Math.min(100, pct) / 100) * circ;

  return (
    <div className="glass rounded-xl p-3 flex flex-col items-center gap-1 min-w-[110px]">
      <motion.div
        initial={{ rotate: -90, scale: 0.9 }}
        animate={{ rotate: -90, scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 18 }}
        className="relative"
      >
        <svg width={72} height={72}>
          <circle cx={36} cy={36} r={radius} fill="none" stroke="hsl(var(--muted))" strokeWidth={6} />
          <motion.circle
            cx={36}
            cy={36}
            r={radius}
            fill="none"
            stroke={stroke}
            strokeWidth={6}
            strokeLinecap="round"
            strokeDasharray={circ}
            initial={{ strokeDashoffset: circ }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center rotate-90">
          <span className="text-sm font-bold text-foreground -rotate-90">{Math.round(pct)}%</span>
        </div>
      </motion.div>
      <p className="text-xs font-bold text-foreground truncate max-w-full">{code}</p>
      <p className="text-[10px] text-muted-foreground">{present}/{total} • {threshold}%</p>
    </div>
  );
}
