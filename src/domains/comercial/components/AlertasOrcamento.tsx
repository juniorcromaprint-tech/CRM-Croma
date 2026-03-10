// src/domains/comercial/components/AlertasOrcamento.tsx

import React from "react";
import { AlertTriangle, Info, XCircle, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import type { OrcamentoAlert } from "../hooks/useOrcamentoAlerts";

interface AlertasOrcamentoProps {
  alerts: OrcamentoAlert[];
}

const SEVERITY_STYLES: Record<string, { bg: string; border: string; text: string; icon: React.ReactNode }> = {
  error: {
    bg: "bg-red-50",
    border: "border-red-200",
    text: "text-red-800",
    icon: <XCircle size={14} className="text-red-500 shrink-0 mt-0.5" />,
  },
  warning: {
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-800",
    icon: <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />,
  },
  info: {
    bg: "bg-blue-50",
    border: "border-blue-200",
    text: "text-blue-800",
    icon: <Info size={14} className="text-blue-500 shrink-0 mt-0.5" />,
  },
};

export default function AlertasOrcamento({ alerts }: AlertasOrcamentoProps) {
  if (alerts.length === 0) return null;

  return (
    <div className="space-y-2">
      {alerts.map((alert) => {
        const style = SEVERITY_STYLES[alert.severity];
        return (
          <div
            key={alert.id}
            className={`flex items-start gap-2 ${style.bg} border ${style.border} rounded-xl p-3 text-xs ${style.text}`}
          >
            {style.icon}
            <div className="flex-1 min-w-0">
              <span className="font-semibold">{alert.title}: </span>
              <span>{alert.message}</span>
              {alert.action && (
                <Link
                  to={alert.action.href}
                  className="ml-2 inline-flex items-center gap-0.5 font-semibold underline hover:no-underline"
                >
                  {alert.action.label}
                  <ExternalLink size={10} />
                </Link>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
