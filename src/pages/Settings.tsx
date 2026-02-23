import React, { useState, useRef } from "react";
import { Upload, FileSpreadsheet, AlertCircle, Loader2, Database, FileType2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import Papa from "papaparse";
import * as XLSX from "xlsx";

export default function Settings() {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Normaliza as chaves (remove acentos, espaços extras e deixa minúsculo)
  const normalizeKey = (key: string) => {
    return key.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  };

  // Busca inteligente: procura se alguma coluna contém as palavras-chave
  const findValue = (row: Record<string, string>, possibleMatches: string[]) => {
    const keys = Object.keys(row);
    for (const match of possibleMatches) {
      const foundKey = keys.find(k => k.includes(match));
      if (foundKey && row[foundKey] !== undefined && row[foundKey] !== "") {
        return String(row[foundKey]).trim();
      }
    }
    return null;
  };

  const processData = async (rows: any[]) => {
    try {
      setProgress(30);
      
      const storesToInsert = rows.map(row => {
        const normalizedRow: Record<string, string> = {};
        Object.keys(row).forEach(key => {
          normalizedRow[normalizeKey(key)] = row[key];
        });

        // Mapeamento super flexível
        const name = findValue(normalizedRow, ['nome fantasia', 'fantasia', 'nome', 'loja']);
        const corporateName = findValue(normalizedRow, ['razao', 'social', 'empresa']);
        
        return {
          code: findValue(normalizedRow, ['codigo', 'cod', 'cliente', 'id']),
          corporate_name: corporateName,
          name: name || corporateName || 'Loja Sem Nome', // Se não tiver nome fantasia, usa a razão social
          cnpj: findValue(normalizedRow, ['cnpj', 'documento']),
          address: findValue(normalizedRow, ['endereco', 'rua', 'logradouro']),
          state: findValue(normalizedRow, ['uf', 'estado', 'cidade', 'municipio']),
          neighborhood: findValue(normalizedRow, ['bairro']),
          zip_code: findValue(normalizedRow, ['cep']),
          brand: findValue(normalizedRow, ['grupo', 'marca', 'rede', 'bandeira']) || 'Sem Grupo',
          email: findValue(normalizedRow, ['email', 'e-mail']),
          phone: findValue(normalizedRow, ['fone', 'telefone', 'celular', 'contato']),
        };
      });

      setProgress(50);

      // Inserindo no Supabase em lotes de 100
      const batchSize = 100;
      for (let i = 0; i < storesToInsert.length; i += batchSize) {
        const batch = storesToInsert.slice(i, i + batchSize);
        const { error } = await supabase.from('stores').insert(batch);
        
        if (error) throw error;
        
        const currentProgress = 50 + Math.floor(((i + batchSize) / storesToInsert.length) * 50);
        setProgress(Math.min(currentProgress, 99));
      }

      setProgress(100);
      showSuccess(`${storesToInsert.length} clientes importados com sucesso!`);
      
    } catch (error) {
      console.error("Erro na importação:", error);
      showError("Erro ao salvar os dados no banco. Tente novamente.");
    } finally {
      setIsUploading(false);
      setTimeout(() => setProgress(0), 2000);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setProgress(10);

    const fileExt = file.name.split('.').pop()?.toLowerCase();

    if (fileExt === 'csv') {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => processData(results.data),
        error: (error) => {
          console.error("Erro ao ler CSV:", error);
          showError("Erro ao ler o arquivo CSV.");
          setIsUploading(false);
        }
      });
    } else if (fileExt === 'xlsx' || fileExt === 'xls') {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const worksheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[worksheetName];
          const rows = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
          processData(rows);
        } catch (error) {
          console.error("Erro ao ler Excel:", error);
          showError("Erro ao ler o arquivo Excel. Verifique se não está corrompido.");
          setIsUploading(false);
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      showError("Formato de arquivo não suportado. Use .xlsx, .xls ou .csv");
      setIsUploading(false);
    }
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
                <CardDescription className="text-slate-500">Faça upload de uma planilha para cadastrar múltiplos clientes de uma vez.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6 flex gap-3">
              <AlertCircle className="text-blue-600 shrink-0 mt-0.5" size={20} />
              <div className="text-sm text-blue-800">
                <p className="font-bold mb-1">Como preparar sua planilha:</p>
                <p className="mb-2">Você pode enviar arquivos <strong>Excel (.xlsx, .xls)</strong> ou <strong>CSV</strong>. O sistema é inteligente e tentará encontrar as colunas automaticamente, mesmo que os nomes estejam um pouco diferentes.</p>
                <p className="text-xs opacity-80 mt-2">Exemplos de colunas reconhecidas: Código, Razão Social, Nome Fantasia, CNPJ, Endereço, Cidade, UF, Bairro, CEP, Grupo/Marca, Email, Telefone.</p>
              </div>
            </div>

            <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-2xl p-10 bg-slate-50 hover:bg-slate-100 hover:border-blue-300 transition-colors">
              <input 
                type="file" 
                accept=".csv, .xlsx, .xls" 
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
                  <div className="flex gap-2 mb-4">
                    <div className="w-14 h-14 bg-green-100 rounded-full shadow-sm flex items-center justify-center text-green-600">
                      <FileSpreadsheet size={28} />
                    </div>
                    <div className="w-14 h-14 bg-blue-100 rounded-full shadow-sm flex items-center justify-center text-blue-600">
                      <FileType2 size={28} />
                    </div>
                  </div>
                  <h3 className="text-lg font-bold text-slate-800 mb-1">Selecione o arquivo Excel ou CSV</h3>
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