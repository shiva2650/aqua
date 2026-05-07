import { motion } from 'motion/react';
import { cn } from '../lib/utils';

interface GaugeProps {
  value: number;
  min: number;
  max: number;
  label: string;
  unit: string;
  color?: string;
  className?: string;
}

export default function Gauge({ value, min, max, label, unit, color = '#0ea5e9', className }: GaugeProps) {
  const percentage = Math.min(Math.max(((value - min) / (max - min)) * 100, 0), 100);
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className={cn("relative flex flex-col items-center justify-center p-6 glass hover:glow-cyan group", className)}>
      <svg className="w-28 h-28 transform -rotate-90">
        {/* Background track */}
        <circle
          cx="56"
          cy="56"
          r={radius}
          stroke="currentColor"
          strokeWidth="4"
          fill="transparent"
          className="text-slate-800"
        />
        {/* Progress track */}
        <motion.circle
          cx="56"
          cy="56"
          r={radius}
          stroke={color}
          strokeWidth="6"
          fill="transparent"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          strokeLinecap="round"
          className="filter drop-shadow-[0_0_8px_rgba(14,165,233,0.4)]"
        />
      </svg>
      
      <div className="absolute inset-0 flex flex-col items-center justify-center translate-y-1">
        <span className={cn(
          "font-bold font-mono tracking-tighter text-slate-50",
          value >= 100 ? "text-xl" : "text-2xl"
        )}>
          {value.toFixed(1)}
        </span>
        <span className="text-[9px] uppercase tracking-[0.2em] text-slate-500 font-bold">{unit}</span>
      </div>
      
      <span className="mt-2 text-xs font-semibold uppercase tracking-widest text-slate-400">{label}</span>
      
      {/* Target range indicator bar as seen in design */}
      <div className="w-full mt-4 bg-slate-800 h-1 rounded-full overflow-hidden">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          className="h-full"
          style={{ backgroundColor: color }}
        />
      </div>
    </div>
  );
}
