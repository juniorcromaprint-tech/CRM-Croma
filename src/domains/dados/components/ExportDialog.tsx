import { useState } from 'react';
import { Download } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { useExport } from '../hooks/useExport';
import { getEntity } from '../configs/entity-registry';

interface ExportDialogProps {
  entityKey: string;
  trigger?: React.ReactNode;
}

export function ExportDialog({ entityKey, trigger }: ExportDialogProps) {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<'csv' | 'xlsx'>('xlsx');
  const entity = getEntity(entityKey);
  const [selectedColumns, setSelectedColumns] = useState<string[]>(
    entity?.columns.filter(c => c.key !== 'id' && c.exportable !== false).map(c => c.key) ?? []
  );
  const { runExport, isExporting } = useExport();

  if (!entity) return null;

  const toggleColumn = (key: string) => {
    setSelectedColumns(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const handleExport = async () => {
    await runExport({ entityKey, format, selectedColumns });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm">
            <Download size={14} className="mr-1.5" />
            Exportar
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Exportar {entity.labelPlural}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Formato */}
          <div>
            <Label className="text-sm font-medium">Formato</Label>
            <RadioGroup
              value={format}
              onValueChange={(v) => setFormat(v as 'csv' | 'xlsx')}
              className="flex gap-4 mt-2"
            >
              <div className="flex items-center gap-1.5">
                <RadioGroupItem value="xlsx" id="xlsx" />
                <Label htmlFor="xlsx">Excel (.xlsx)</Label>
              </div>
              <div className="flex items-center gap-1.5">
                <RadioGroupItem value="csv" id="csv" />
                <Label htmlFor="csv">CSV (.csv)</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Colunas */}
          <div>
            <Label className="text-sm font-medium">Colunas</Label>
            <div className="mt-2 grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
              {entity.columns
                .filter(c => c.key !== 'id' && c.exportable !== false)
                .map(col => (
                  <div key={col.key} className="flex items-center gap-2">
                    <Checkbox
                      id={`col-${col.key}`}
                      checked={selectedColumns.includes(col.key)}
                      onCheckedChange={() => toggleColumn(col.key)}
                    />
                    <Label htmlFor={`col-${col.key}`} className="text-sm font-normal cursor-pointer">
                      {col.label}
                    </Label>
                  </div>
                ))}
            </div>
          </div>
        </div>

        <Button
          onClick={handleExport}
          disabled={isExporting || selectedColumns.length === 0}
          className="w-full bg-blue-600 hover:bg-blue-700"
        >
          {isExporting ? 'Exportando...' : `Exportar ${entity.labelPlural}`}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
