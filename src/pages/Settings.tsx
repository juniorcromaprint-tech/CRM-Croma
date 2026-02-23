import React, { useState, useRef } from "react";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Loader2, Database } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import Papa from "papaparse";

export default function Settings() {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Função para normalizar os nomes das colunas (remover acentos, espaços, etc)
  const normalizeKey = (key: string) => {
    return key.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setProgress(10);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          setProgress(30);
          const rows = results.data as any[];
          
          // Mapeando as colunas da planilha para o banco de dados
          const storesToInsert = rows.map(row => {
            // Criamos um objeto com chaves normalizadas para facilitar a busca
            const normalizedRow: Record<string, string> = {};
            Object.keys(row).forEach(key => {
              normalizedRow[normalizeKey(key)] = row[key];
            });

            return {
              code: normalizedRow['codigo'] || null,
              corporate_name: normalizedRow['razao social'] || null,
              name: normalizedRow['nome'] || 'Loja Sem Nome', // Obrigatório
              cnpj: normalizedRow['cnpj'] || null,
              address: normalizedRow['endereco'] || null,
              state: normalizedRow['uf'] || null,
              neighborhood: normalizedRow['bairro'] || null,
              zip_code: normalizedRow['cep'] || null,
              brand: normalizedRow['grupo'] || 'Sem Grupo', // Obrigatório
              email: normalizedRow['email'] || null,
              phone: normalizedRow['fone'] || normalizedRow['telefone'] || null,
            };
          });

          setProgress(50);

          // Inserindo no Supabase em lotes de 100 para não sobrecarregar
          const batchSize = 100;
          for (let i = 0; i < storesToInsert.length; i += batchSize) {
            const batch = storesToInsert.slice(i, i + batchSize);
            const { error } = await supabase.from('stores').insert(batch);
            
            if (error) throw error;
            
            // Atualiza o progresso
            const currentProgress = 50 + Math.floor(((i + batchSize) / storesToInsert.length) * 50);
            setProgress(Math.min(currentProgress, 99));
          }

          setProgress(100);
          showSuccess(`${storesToInsert.length} clientes importados com sucesso!`);
          
        } catch (error) {
          console.error("Erro na importação:", error);
          showError("Erro ao importar a planilha. Verifique se as colunas estão corretas.");
        } finally {
          setIsUploading(false);
          setTimeout(() => setProgress(0), 2000);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      },
      error: (error) => {
        console.error("Erro ao ler CSV:", error);
        showError("Erro ao ler o arquivo CSV.");
        setIsUploading(false);
      }
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-800">Configurações</h1>
        <p className="text-slate-500 mt-1">Gerencie as preferências e dados do sistema.</p>
      </div>

      <div className="grid gap-6">
        <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden">
          <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                <Database size={20} />
              </div>
              <div>
                <CardTitle className="text-lg font-bold text-slate-800">Importar Clientes / Lojas</CardTitle>
                <CardDescription className="text-slate-500">Faça upload de uma planilha CSV para cadastrar múltiplos clientes de uma vez.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6 flex gap-3">
              <AlertCircle className="text-blue-600 shrink-0 mt-0.5" size={20} />
              <div className="text-sm text-blue-800">
                <p className="font-bold mb-1">Como preparar sua planilha:</p>
                <p className="mb-2">Salve sua planilha Excel ou Google Sheets no formato <strong>CSV (Valores separados por vírgula)</strong>. O sistema tentará ler automaticamente as seguintes colunas:</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {['Código', 'Razão social', 'Nome', 'CNPJ', 'Endereço', 'UF', 'Bairro', 'CEP', 'Grupo', 'Email', 'Fone'].map(col => (
                    <span key={col} className="bg-white px-2 py-1 rounded-md border border-blue-200 text-xs font-medium text-blue-700">
                      {col}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-2xl p-10 bg-slate-50 hover:bg-slate-100 hover:border-blue-300 transition-colors">
              <input 
                type="file" 
                accept=".csv" 
                className="hidden" 
                ref={fileInputRef}
                onChange={handleFileUpload}
                disabled={isUploading}
              />
              
              {isUploading ? (
                <div className="flex flex-col items-center text-center">
                  <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
                  <h3 className="text-lg font-bold text-slate-800 mb-1">Importando dados...</h3>
                  <p className="text-sm text-slate-500 mb-4">Por favor, não feche esta página.</p>
                  <div className="w-64 h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-600 transition-all duration-300 ease-out"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center text-center">
                  <div className="w-16 h-16 bg-white rounded-full shadow-sm flex items-center justify-center mb-4 text-blue-600">
                    <FileSpreadsheet size={32} />
                  </div>
                  <h3 className="text-lg font-bold text-slate-800 mb-1">Selecione o arquivo CSV</h3>
                  <p className="text-sm text-slate-500 mb-6 max-w-md">
                    O arquivo deve conter o cabeçalho na primeira linha. O sistema fará a leitura e importação automática.
                  </p>
                  <Button 
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-8 h-12 font-bold shadow-sm"
                  >
                    <Upload className="mr-2" size={20} /> Escolher Arquivo
                  </Button>
                </div>
              )}
            </div>

          </CardContent>
        </Card>
      </div>
    </div>
  );
}