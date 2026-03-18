import { useState, useEffect } from 'react';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useConfigTributaria, useUpdateConfigTributaria } from '../hooks/useConfigTributaria';

export function TabTributario() {
  const { data: config, isLoading } = useConfigTributaria();
  const update = useUpdateConfigTributaria();

  const [form, setForm] = useState({
    regime: 'simples_nacional',
    pro_labore_mensal: '',
    inss_pro_labore_percentual: '11.00',
    cnae_principal: '',
    anexo_padrao: 'V' as 'III' | 'V',
    observacoes: '',
  });

  useEffect(() => {
    if (config) {
      setForm({
        regime: config.regime,
        pro_labore_mensal: String(config.pro_labore_mensal),
        inss_pro_labore_percentual: String(config.inss_pro_labore_percentual),
        cnae_principal: config.cnae_principal ?? '',
        anexo_padrao: config.anexo_padrao,
        observacoes: config.observacoes ?? '',
      });
    }
  }, [config]);

  function handleSave() {
    update.mutate({
      regime: form.regime,
      pro_labore_mensal: parseFloat(form.pro_labore_mensal) || 0,
      inss_pro_labore_percentual: parseFloat(form.inss_pro_labore_percentual) || 11,
      cnae_principal: form.cnae_principal || null,
      anexo_padrao: form.anexo_padrao,
      observacoes: form.observacoes || null,
    });
  }

  if (isLoading) {
    return <div className="p-6 text-sm text-slate-400">Carregando...</div>;
  }

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h3 className="font-semibold text-slate-700 mb-1">Configuração Tributária</h3>
        <p className="text-sm text-slate-400">
          Dados usados para cálculo automático do DAS e Fator R
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <Label className="text-xs text-slate-500 mb-1.5 block">Regime Tributário</Label>
          <Select value={form.regime} onValueChange={(v) => setForm(f => ({ ...f, regime: v }))}>
            <SelectTrigger className="rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="simples_nacional">Simples Nacional</SelectItem>
              <SelectItem value="lucro_presumido">Lucro Presumido</SelectItem>
              <SelectItem value="lucro_real">Lucro Real</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-xs text-slate-500 mb-1.5 block">Pró-labore Mensal (R$)</Label>
          <Input
            type="number"
            min="0"
            step="100"
            placeholder="Ex: 3000"
            value={form.pro_labore_mensal}
            onChange={(e) => setForm(f => ({ ...f, pro_labore_mensal: e.target.value }))}
            className="rounded-xl"
          />
          <p className="text-xs text-slate-400 mt-1">
            Usado para calcular o Fator R — quanto mais próximo de 28% do RBT12, melhor
          </p>
        </div>

        <div>
          <Label className="text-xs text-slate-500 mb-1.5 block">INSS sobre Pró-labore (%)</Label>
          <Input
            type="number"
            min="0"
            max="20"
            step="0.1"
            value={form.inss_pro_labore_percentual}
            onChange={(e) => setForm(f => ({ ...f, inss_pro_labore_percentual: e.target.value }))}
            className="rounded-xl"
          />
        </div>

        <div>
          <Label className="text-xs text-slate-500 mb-1.5 block">Anexo Padrão</Label>
          <Select
            value={form.anexo_padrao}
            onValueChange={(v) => setForm(f => ({ ...f, anexo_padrao: v as 'III' | 'V' }))}
          >
            <SelectTrigger className="rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="III">Anexo III (Serviços — menor alíquota)</SelectItem>
              <SelectItem value="V">Anexo V (Serviços — base)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-slate-400 mt-1">
            O sistema calcula automaticamente baseado no Fator R — este é o padrão quando não há dados
          </p>
        </div>

        <div>
          <Label className="text-xs text-slate-500 mb-1.5 block">CNAE Principal</Label>
          <Input
            type="text"
            placeholder="Ex: 1821-1/00"
            value={form.cnae_principal}
            onChange={(e) => setForm(f => ({ ...f, cnae_principal: e.target.value }))}
            className="rounded-xl"
          />
        </div>

        <div>
          <Label className="text-xs text-slate-500 mb-1.5 block">Observações</Label>
          <Textarea
            placeholder="Anotações para o contador..."
            value={form.observacoes}
            onChange={(e) => setForm(f => ({ ...f, observacoes: e.target.value }))}
            className="rounded-xl resize-none"
            rows={3}
          />
        </div>
      </div>

      <Button
        className="bg-blue-600 hover:bg-blue-700 gap-2"
        onClick={handleSave}
        disabled={update.isPending}
      >
        <Save size={14} />
        {update.isPending ? 'Salvando...' : 'Salvar Configuração'}
      </Button>
    </div>
  );
}
