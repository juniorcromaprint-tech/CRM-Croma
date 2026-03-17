import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface WizardStep {
  id: string;
  label: string;
  description?: string;
}

interface StepWizardProps {
  steps: WizardStep[];
  currentStep: number; // 0-based
  className?: string;
}

export function StepWizard({ steps, currentStep, className }: StepWizardProps) {
  const total = steps.length;
  const activeStep = steps[currentStep];

  return (
    <div className={cn('w-full', className)}>
      {/* Mobile */}
      <div className="sm:hidden flex items-center gap-2 text-sm">
        <span className="font-semibold text-slate-700">
          {currentStep + 1} de {total}
        </span>
        {activeStep && (
          <>
            <span className="text-slate-400">·</span>
            <span className="text-slate-600">{activeStep.label}</span>
          </>
        )}
      </div>

      {/* Desktop */}
      <nav aria-label="Progresso" className="hidden sm:flex items-start">
        {steps.map((step, index) => {
          const isDone = index < currentStep;
          const isActive = index === currentStep;
          const isLast = index === total - 1;

          return (
            <div key={step.id} className="flex items-start flex-1 last:flex-none">
              {/* Step circle + label */}
              <div className="flex flex-col items-center gap-1.5 min-w-0">
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 transition-colors',
                    isDone && 'bg-emerald-100 text-emerald-600',
                    isActive && 'bg-blue-600 text-white ring-4 ring-blue-100',
                    !isDone && !isActive && 'bg-slate-100 text-slate-400',
                  )}
                  aria-current={isActive ? 'step' : undefined}
                >
                  {isDone ? <Check size={14} strokeWidth={2.5} /> : index + 1}
                </div>
                <div className="text-center px-1">
                  <p
                    className={cn(
                      'text-xs font-medium leading-tight',
                      isActive ? 'text-slate-800' : isDone ? 'text-slate-500' : 'text-slate-400',
                    )}
                  >
                    {step.label}
                  </p>
                  {step.description && (
                    <p className="text-xs text-slate-400 mt-0.5 leading-tight">{step.description}</p>
                  )}
                </div>
              </div>

              {/* Connector line */}
              {!isLast && (
                <div className="flex-1 mt-4 mx-1">
                  <div
                    className={cn(
                      'h-0.5 w-full transition-colors',
                      isDone ? 'bg-emerald-300' : 'bg-slate-200',
                    )}
                  />
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </div>
  );
}
