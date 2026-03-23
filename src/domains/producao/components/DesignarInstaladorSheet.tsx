import { CnhBadge, getCnhStatus } from "@/shared/components/CnhBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";

interface DesignarInstaladorSheetProps {
  open: boolean;
  opId: string | null;
  onOpenChange: (open: boolean) => void;
  instaladores: any[];
  selectedInstalador: string;
  setSelectedInstalador: (v: string) => void;
  dataAgendada: string;
  setDataAgendada: (v: string) => void;
  horaPrevista: string;
  setHoraPrevista: (v: string) => void;
  instrucoes: string;
  setInstrucoes: (v: string) => void;
  onDesignar: (params: {
    opId: string;
    equipeId: string;
    dataAgendadaVal: string;
    horaPrevistaVal?: string;
    instrucoesVal?: string;
  }) => void;
  onCriarSemDesignar: (opId: string) => void;
  isDesignarPending: boolean;
  isCriarSemDesignarPending: boolean;
}

export default function DesignarInstaladorSheet({
  open,
  opId,
  onOpenChange,
  instaladores,
  selectedInstalador,
  setSelectedInstalador,
  dataAgendada,
  setDataAgendada,
  horaPrevista,
  setHoraPrevista,
  instrucoes,
  setInstrucoes,
  onDesignar,
  onCriarSemDesignar,
  isDesignarPending,
  isCriarSemDesignarPending,
}: DesignarInstaladorSheetProps) {
  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (!o) onOpenChange(false);
      }}
    >
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Designar Instalador</SheetTitle>
          <p className="text-sm text-slate-500">
            A produção foi concluída. Designe um instalador para enviar ao App de Campo.
          </p>
        </SheetHeader>
        <div className="space-y-4 mt-6">
          <div>
            <Label>Instalador *</Label>
            <Select
              value={selectedInstalador}
              onValueChange={(val) => {
                const inst = instaladores.find((i: any) => i.id === val);
                const { status } = getCnhStatus(inst?.cnh_validade);
                if (status === 'vencida') return;
                setSelectedInstalador(val);
              }}
            >
              <SelectTrigger><SelectValue placeholder="Selecione o instalador" /></SelectTrigger>
              <SelectContent>
                {instaladores.map((inst: any) => {
                  const { status } = getCnhStatus(inst.cnh_validade);
                  const bloqueado = status === 'vencida';
                  return (
                    <SelectItem
                      key={inst.id}
                      value={inst.id}
                      disabled={bloqueado}
                      className={bloqueado ? "opacity-50 cursor-not-allowed" : ""}
                    >
                      <span className="flex items-center gap-2 flex-wrap">
                        <span>{inst.first_name} {inst.last_name}</span>
                        <CnhBadge cnhValidade={inst.cnh_validade} cnhCategoria={inst.cnh_categoria} />
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {selectedInstalador && (() => {
              const inst = instaladores.find((i: any) => i.id === selectedInstalador);
              const { status } = getCnhStatus(inst?.cnh_validade);
              if (status === 'vence_em_breve') {
                return (
                  <p className="text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 mt-2">
                    Atenção: A CNH deste instalador vence em breve. Verifique antes de agendar instalações futuras.
                  </p>
                );
              }
              return null;
            })()}
          </div>
          <div>
            <Label>Data agendada *</Label>
            <Input type="date" value={dataAgendada} onChange={(e) => setDataAgendada(e.target.value)} />
          </div>
          <div>
            <Label>Hora prevista</Label>
            <Input type="time" value={horaPrevista} onChange={(e) => setHoraPrevista(e.target.value)} />
          </div>
          <div>
            <Label>Instruções para o instalador</Label>
            <Textarea
              placeholder="Ex: Levar escada, material já está na loja..."
              value={instrucoes}
              onChange={(e) => setInstrucoes(e.target.value)}
            />
          </div>
          <Button
            className="w-full bg-blue-600 hover:bg-blue-700"
            disabled={!selectedInstalador || !dataAgendada || isDesignarPending}
            onClick={() => {
              if (opId && selectedInstalador && dataAgendada) {
                onDesignar({
                  opId,
                  equipeId: selectedInstalador,
                  dataAgendadaVal: dataAgendada,
                  horaPrevistaVal: horaPrevista || undefined,
                  instrucoesVal: instrucoes || undefined,
                });
              }
            }}
          >
            {isDesignarPending ? <Loader2 className="animate-spin mr-2" size={16} /> : null}
            Confirmar e Enviar ao Campo
          </Button>
          <button
            type="button"
            className="w-full text-sm text-slate-500 hover:text-slate-700 py-2"
            onClick={() => {
              if (opId) {
                onCriarSemDesignar(opId);
              }
            }}
          >
            {isCriarSemDesignarPending ? 'Criando...' : 'Criar sem designar agora'}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
