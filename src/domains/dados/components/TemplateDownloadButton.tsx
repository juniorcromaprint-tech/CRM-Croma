import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { downloadTemplate } from '../engine/template-generator';
import { getEntity } from '../configs/entity-registry';

interface TemplateDownloadButtonProps {
  entityKey: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'icon';
}

export function TemplateDownloadButton({ entityKey, variant = 'outline', size = 'sm' }: TemplateDownloadButtonProps) {
  const entity = getEntity(entityKey);
  if (!entity) return null;

  return (
    <Button
      variant={variant}
      size={size}
      onClick={() => downloadTemplate(entity)}
      title={`Baixar modelo para ${entity.label}`}
    >
      <Download size={14} className="mr-1.5" />
      Baixar Modelo
    </Button>
  );
}
