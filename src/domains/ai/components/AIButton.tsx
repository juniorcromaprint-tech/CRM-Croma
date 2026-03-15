// src/domains/ai/components/AIButton.tsx

import { Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AIButtonProps {
  label: string;
  onClick: () => void;
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
  return (
    <Button
      variant={variant}
      size={size}
      onClick={onClick}
      disabled={disabled || isLoading}
      className={`rounded-xl gap-1.5 ${className}`}
    >
      {isLoading ? (
        <Loader2 size={14} className="animate-spin" />
      ) : (
        <Sparkles size={14} className="text-amber-500" />
      )}
      {isLoading ? 'Analisando...' : label}
    </Button>
  );
}
