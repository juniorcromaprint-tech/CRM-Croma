import React from "react";
import { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
}

export default function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
      <Icon size={40} className="mx-auto text-slate-300 mb-3" />
      <h3 className="font-semibold text-slate-600">{title}</h3>
      <p className="text-sm text-slate-400 mt-1">{description}</p>
      {action && (
        <Button onClick={action.onClick} className="mt-4 bg-blue-600 hover:bg-blue-700 rounded-xl">
          {action.label}
        </Button>
      )}
    </div>
  );
}
