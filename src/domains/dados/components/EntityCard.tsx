import { useState } from 'react';
import * as Icons from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ExportDialog } from './ExportDialog';
import { ImportWizard } from './ImportWizard';
import { TemplateDownloadButton } from './TemplateDownloadButton';
import type { EntityConfig } from '../configs/entity-registry';

interface EntityCardProps {
  entity: EntityConfig;
}

export function EntityCard({ entity }: EntityCardProps) {
  const [importOpen, setImportOpen] = useState(false);

  const { data: count } = useQuery({
    queryKey: ['entity-count', entity.table],
    queryFn: async () => {
      const { count } = await supabase
        .from(entity.table)
        .select('*', { count: 'exact', head: true });
      return count ?? 0;
    },
  });

  // Dynamic icon from lucide-react
  const IconComponent = (Icons as Record<string, unknown>)[entity.icon] as
    | React.ComponentType<{ size?: number; className?: string }>
    | undefined;

  return (
    <>
      <Card className="rounded-2xl hover:shadow-md transition-shadow">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-3">
            {IconComponent && <IconComponent size={20} className="text-blue-600" />}
            <CardTitle className="text-base">{entity.labelPlural}</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-slate-700 mb-4">
            {count ?? '—'}
            <span className="text-sm font-normal text-slate-400 ml-2">registros</span>
          </p>
          <div className="flex flex-wrap gap-2">
            <ExportDialog
              entityKey={entity.key}
              trigger={
                <Button variant="outline" size="sm" className="flex-1">
                  Exportar
                </Button>
              }
            />
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => setImportOpen(true)}
            >
              Importar
            </Button>
            <TemplateDownloadButton entityKey={entity.key} />
          </div>
        </CardContent>
      </Card>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Importar {entity.labelPlural}</DialogTitle>
          </DialogHeader>
          <ImportWizard entityKey={entity.key} onClose={() => setImportOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}
