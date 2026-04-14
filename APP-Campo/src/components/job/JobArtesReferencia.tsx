/**
 * JobArtesReferencia.tsx (App Campo)
 *
 * Busca os pedido_itens vinculados ao job (via pedido_id) e exibe os previews
 * das artes para o instalador ver o que ele esta instalando. Usa apenas os
 * previews JPG leves (arte_preview_url), nunca os PDFs originais — o original
 * pode ser baixado via link se necessario.
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ImageIcon, ExternalLink, X, Ruler } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

type PedidoItemArte = {
  id: string;
  descricao: string;
  especificacao: string | null;
  quantidade: number;
  unidade: string;
  largura_cm: number | null;
  altura_cm: number | null;
  arte_url: string | null;
  arte_preview_url: string | null;
  arte_nome_original: string | null;
};

type Props = {
  pedidoId: string | null | undefined;
};

export default function JobArtesReferencia({ pedidoId }: Props) {
  const [zoomUrl, setZoomUrl] = useState<string | null>(null);
  const [zoomNome, setZoomNome] = useState<string>("");
  const [zoomOriginal, setZoomOriginal] = useState<string | null>(null);

  const { data: itens = [], isLoading } = useQuery({
    queryKey: ["job-artes", pedidoId],
    enabled: !!pedidoId,
    staleTime: 60 * 1000,
    queryFn: async (): Promise<PedidoItemArte[]> => {
      if (!pedidoId) return [];
      const { data, error } = await supabase
        .from("pedido_itens")
        .select(
          "id, descricao, especificacao, quantidade, unidade, largura_cm, altura_cm, arte_url, arte_preview_url, arte_nome_original",
        )
        .eq("pedido_id", pedidoId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as PedidoItemArte[];
    },
  });

  if (!pedidoId) return null;
  if (isLoading) return null;

  const itensComArte = itens.filter((i) => i.arte_preview_url || i.arte_url);
  if (itensComArte.length === 0) return null;

  return (
    <>
      <div className="bg-white p-5 rounded-2xl border shadow-sm mb-6">
        <div className="flex items-center gap-2 mb-4">
          <ImageIcon size={18} className="text-blue-600" />
          <h3 className="font-bold text-slate-800">Arte a instalar</h3>
          <span className="text-xs text-slate-500 ml-auto">
            {itensComArte.length} {itensComArte.length === 1 ? "peça" : "peças"}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {itensComArte.map((item) => {
            const previewUrl = item.arte_preview_url || item.arte_url!;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setZoomUrl(previewUrl);
                  setZoomNome(item.arte_nome_original || item.descricao);
                  setZoomOriginal(item.arte_url);
                }}
                className="group text-left bg-slate-50 rounded-xl border border-slate-200 overflow-hidden hover:ring-2 hover:ring-blue-500 transition"
              >
                <div className="aspect-[4/3] bg-white">
                  <img
                    src={previewUrl}
                    alt={item.descricao}
                    className="w-full h-full object-contain"
                    loading="lazy"
                  />
                </div>
                <div className="p-3 space-y-1">
                  <p className="text-sm font-semibold text-slate-800 line-clamp-2">
                    {item.descricao}
                  </p>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600">
                    <span>
                      <strong className="text-slate-500">Qtd:</strong> {item.quantidade}{" "}
                      {item.unidade || ""}
                    </span>
                    {item.largura_cm && item.altura_cm && (
                      <span className="inline-flex items-center gap-1">
                        <Ruler size={11} />
                        {item.largura_cm} × {item.altura_cm} cm
                      </span>
                    )}
                  </div>
                  {item.especificacao && (
                    <p className="text-[11px] text-slate-500 line-clamp-2">
                      {item.especificacao}
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Lightbox */}
      <Dialog open={!!zoomUrl} onOpenChange={(open) => !open && setZoomUrl(null)}>
        <DialogContent className="max-w-5xl p-3 sm:p-6">
          <div className="flex items-center justify-between gap-2">
            <DialogTitle className="text-slate-800 text-sm sm:text-base line-clamp-1">
              {zoomNome}
            </DialogTitle>
            <button
              type="button"
              onClick={() => setZoomUrl(null)}
              className="p-1 rounded-lg hover:bg-slate-100"
              aria-label="Fechar"
            >
              <X size={18} />
            </button>
          </div>
          {zoomUrl && (
            <div className="overflow-auto max-h-[75vh] rounded-xl bg-slate-50">
              <img src={zoomUrl} alt={zoomNome} className="w-full h-auto" />
            </div>
          )}
          {zoomOriginal && (
            <div className="flex justify-end pt-1">
              <a
                href={zoomOriginal}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
              >
                <ExternalLink size={14} /> Abrir arquivo original
              </a>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
