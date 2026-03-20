import { Sparkles, Loader2, Settings, Check } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAIModels } from '@/domains/ai/hooks/useAIModels';
import { cn } from '@/lib/utils';

interface AIButtonProps {
  label: string;
  onClick: (model?: string) => void;
  isLoading?: boolean;
  disabled?: boolean;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'sm' | 'default';
  className?: string;
}

export default function AIButton({
  label,
  onClick,
  isLoading = false,
  disabled = false,
  variant = 'outline',
  size = 'sm',
  className = '',
}: AIButtonProps) {
  const { models, defaultModel, setDefaultModel } = useAIModels();
  const [open, setOpen] = useState(false);

  function handleMain() {
    onClick(defaultModel);
  }

  function handleSelectModel(slug: string) {
    setDefaultModel.mutate(slug);
    setOpen(false);
  }

  return (
    <div className={cn('flex items-center', className)}>
      <Button
        variant={variant}
        size={size}
        onClick={handleMain}
        disabled={disabled || isLoading}
        className="rounded-xl rounded-r-none border-r-0 gap-1.5 pr-3"
      >
        {isLoading ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <Sparkles size={14} className="text-amber-500" />
        )}
        {isLoading ? 'Analisando...' : label}
      </Button>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant={variant}
            size={size}
            disabled={disabled || isLoading}
            className="rounded-xl rounded-l-none px-2"
          >
            <Settings size={13} className="text-slate-500" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-2" align="end">
          <p className="text-xs text-slate-500 px-2 pb-1.5 font-medium">Modelo de IA</p>
          {models.map((m) => (
            <button
              key={m.slug}
              onClick={() => handleSelectModel(m.slug)}
              className={cn(
                'w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-sm hover:bg-slate-100 transition-colors',
                defaultModel === m.slug && 'bg-blue-50'
              )}
            >
              <span className="flex items-center gap-2">
                <span className="font-medium text-slate-700">{m.label}</span>
                {m.free && (
                  <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">Free</span>
                )}
              </span>
              {defaultModel === m.slug && <Check size={14} className="text-blue-600" />}
            </button>
          ))}
        </PopoverContent>
      </Popover>
    </div>
  );
}
