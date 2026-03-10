import React from "react";
import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { AreaChart, Area, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";

export interface SparklinePoint {
  value: number;
}

export interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  /** Color variant: default is 'blue'. Affects icon bg. */
  color?: "blue" | "green" | "amber" | "red" | "purple" | "cyan" | "slate" | "orange" | "indigo" | "teal" | "rose";
  /** Optional sparkline data points */
  sparkline?: SparklinePoint[];
  /** Optional click handler */
  onClick?: () => void;
  className?: string;
  /** If true, shows a loading skeleton */
  loading?: boolean;
}

const COLOR_MAP: Record<string, { bg: string; text: string; spark: string }> = {
  blue:   { bg: "bg-blue-100",    text: "text-blue-600",    spark: "#3b82f6" },
  green:  { bg: "bg-emerald-100", text: "text-emerald-600", spark: "#10b981" },
  amber:  { bg: "bg-amber-100",   text: "text-amber-600",   spark: "#f59e0b" },
  red:    { bg: "bg-red-100",     text: "text-red-600",     spark: "#ef4444" },
  purple: { bg: "bg-purple-100",  text: "text-purple-600",  spark: "#8b5cf6" },
  cyan:   { bg: "bg-cyan-100",    text: "text-cyan-600",    spark: "#06b6d4" },
  slate:  { bg: "bg-slate-100",   text: "text-slate-600",   spark: "#64748b" },
  orange: { bg: "bg-orange-100",  text: "text-orange-600",  spark: "#f97316" },
  indigo: { bg: "bg-indigo-100",  text: "text-indigo-600",  spark: "#6366f1" },
  teal:   { bg: "bg-teal-100",    text: "text-teal-600",    spark: "#14b8a6" },
  rose:   { bg: "bg-rose-100",    text: "text-rose-600",    spark: "#f43f5e" },
};

function TrendBadge({ trend, value }: { trend: "up" | "down" | "neutral"; value?: string }) {
  if (!value) return null;

  const config = {
    up:      { cls: "bg-emerald-50 text-emerald-600", Icon: ArrowUpRight },
    down:    { cls: "bg-red-50 text-red-600",         Icon: ArrowDownRight },
    neutral: { cls: "bg-slate-50 text-slate-500",     Icon: Minus },
  }[trend];

  const { cls, Icon } = config;

  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full", cls)}>
      <Icon size={12} />
      {value}
    </span>
  );
}

function LoadingSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 animate-pulse">
      <div className="flex items-start justify-between mb-3">
        <div className="w-11 h-11 rounded-xl bg-slate-100" />
        <div className="w-16 h-6 rounded-full bg-slate-100" />
      </div>
      <div className="h-7 w-28 bg-slate-100 rounded mb-2" />
      <div className="h-4 w-20 bg-slate-100 rounded" />
    </div>
  );
}

export default function KpiCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  trendValue,
  color = "blue",
  sparkline,
  onClick,
  className,
  loading = false,
}: KpiCardProps) {
  if (loading) return <LoadingSkeleton />;

  const colors = COLOR_MAP[color] ?? COLOR_MAP.blue;

  return (
    <div
      className={cn(
        "bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-md transition-all duration-200",
        onClick && "cursor-pointer hover:border-slate-300",
        className,
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-3">
        {icon && (
          <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center shrink-0", colors.bg, colors.text)}>
            {icon}
          </div>
        )}
        {trend && trendValue && (
          <TrendBadge trend={trend} value={trendValue} />
        )}
      </div>

      {/* Sparkline (optional) */}
      {sparkline && sparkline.length > 2 && (
        <div className="h-10 -mx-1 mb-2 opacity-60">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparkline} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={`spark-${color}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={colors.spark} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={colors.spark} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="value"
                stroke={colors.spark}
                strokeWidth={2}
                fill={`url(#spark-${color})`}
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="text-2xl font-bold text-slate-800 tabular-nums leading-tight">{value}</div>
      <div className="text-sm text-slate-500 mt-1 leading-tight">{title}</div>
      {subtitle && (
        <div className="text-xs text-slate-400 mt-1 leading-tight">{subtitle}</div>
      )}
    </div>
  );
}
