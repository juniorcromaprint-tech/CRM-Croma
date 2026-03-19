import React, { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckSquare } from "lucide-react";

const DEFAULT_ITEMS = [
  "Conferir medidas no local",
  "Limpar/preparar área de instalação",
  "Fotografar ANTES da instalação",
  "Executar instalação",
  "Fotografar DEPOIS da instalação",
  "Conferir acabamento final",
];

interface JobChecklistProps {
  jobId: string;
  initialData?: Record<string, boolean>;
  onSave: (data: Record<string, boolean>) => void;
  disabled?: boolean;
}

export default function JobChecklist({ jobId, initialData, onSave, disabled }: JobChecklistProps) {
  const [checks, setChecks] = useState<Record<string, boolean>>(() => {
    if (initialData && Object.keys(initialData).length > 0) return initialData;
    return Object.fromEntries(DEFAULT_ITEMS.map(item => [item, false]));
  });

  const completedCount = Object.values(checks).filter(Boolean).length;
  const totalCount = Object.keys(checks).length;

  const toggle = (item: string) => {
    if (disabled) return;
    const updated = { ...checks, [item]: !checks[item] };
    setChecks(updated);
    onSave(updated);
  };

  return (
    <div className="bg-white p-5 rounded-2xl border shadow-sm">
      <div className="flex items-center justify-between border-b pb-2 mb-3">
        <label className="text-sm font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
          <CheckSquare size={16} /> Checklist
        </label>
        <span className={`text-xs font-bold px-2 py-1 rounded-full ${
          completedCount === totalCount ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'
        }`}>
          {completedCount}/{totalCount}
        </span>
      </div>
      <div className="space-y-3">
        {Object.entries(checks).map(([item, checked]) => (
          <label
            key={item}
            className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ${
              checked ? 'bg-green-50 border border-green-200' : 'bg-slate-50 border border-slate-100 hover:bg-slate-100'
            } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
            onClick={() => toggle(item)}
          >
            <Checkbox checked={checked} disabled={disabled} className="pointer-events-none" />
            <span className={`text-sm font-medium ${checked ? 'text-green-700 line-through' : 'text-slate-700'}`}>
              {item}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
