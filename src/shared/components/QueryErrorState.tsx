import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface QueryErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

/**
 * Standardized error state for failed useQuery calls.
 * Drop-in replacement for pages that show blank on error.
 */
export default function QueryErrorState({
  message = "Erro ao carregar dados",
  onRetry,
}: QueryErrorStateProps) {
  return (
    <div className="flex items-center justify-center h-96">
      <div className="text-center max-w-sm">
        <AlertTriangle size={48} className="mx-auto text-amber-400 mb-3" />
        <h3 className="font-semibold text-slate-700 text-lg">
          {message}
        </h3>
        <p className="text-sm text-slate-400 mt-1 mb-4">
          Verifique sua conexão e tente novamente.
        </p>
        {onRetry && (
          <Button
            onClick={onRetry}
            variant="outline"
            className="rounded-xl"
          >
            <RefreshCw size={16} className="mr-2" />
            Tentar novamente
          </Button>
        )}
      </div>
    </div>
  );
}
