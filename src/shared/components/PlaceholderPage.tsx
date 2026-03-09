import { Construction } from "lucide-react";

interface PlaceholderPageProps {
  title: string;
  description?: string;
  phase?: string;
}

export default function PlaceholderPage({ title, description, phase = "Em desenvolvimento" }: PlaceholderPageProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="w-20 h-20 rounded-3xl bg-blue-50 flex items-center justify-center mb-6">
        <Construction className="w-10 h-10 text-blue-400" />
      </div>
      <h1 className="text-2xl font-bold text-slate-800 mb-2">{title}</h1>
      {description && <p className="text-slate-500 max-w-md mb-4">{description}</p>}
      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
        {phase}
      </span>
    </div>
  );
}
