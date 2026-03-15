// src/shared/components/AbrirOcorrenciaButton.tsx

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import OcorrenciaForm from "@/domains/qualidade/components/OcorrenciaForm";

interface Props {
  pedido_id?: string;
  ordem_producao_id?: string;
  fornecedor_id?: string;
}

export function AbrirOcorrenciaButton({ pedido_id, ordem_producao_id, fornecedor_id }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <AlertTriangle className="w-4 h-4 mr-1" /> Abrir Ocorrência
      </Button>
      <OcorrenciaForm
        open={open}
        onClose={() => setOpen(false)}
        defaults={{ pedido_id, ordem_producao_id, fornecedor_id }}
      />
    </>
  );
}
