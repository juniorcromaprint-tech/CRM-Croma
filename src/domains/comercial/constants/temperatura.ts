import { Flame, Snowflake, Sun, type LucideIcon } from "lucide-react";
import type { LeadTemperatura } from "../hooks/useLeads";

export interface TemperaturaConfig {
  label: string;
  /** Badge-style Tailwind classes, e.g. "bg-cyan-100 text-cyan-700" */
  badgeColor: string;
  /** Icon component from lucide-react */
  icon: LucideIcon;
  /** Single-color Tailwind class for inline text + icon */
  textClass: string;
}

export const TEMPERATURA_CONFIG: Record<LeadTemperatura, TemperaturaConfig> = {
  frio: {
    label: "Frio",
    badgeColor: "bg-cyan-100 text-cyan-700",
    icon: Snowflake,
    textClass: "text-blue-500",
  },
  morno: {
    label: "Morno",
    badgeColor: "bg-amber-100 text-amber-700",
    icon: Sun,
    textClass: "text-amber-500",
  },
  quente: {
    label: "Quente",
    badgeColor: "bg-red-100 text-red-700",
    icon: Flame,
    textClass: "text-red-500",
  },
};
