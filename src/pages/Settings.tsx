import React, { useState, useRef } from "react";
import { Upload, FileSpreadsheet, AlertCircle, Loader2, Database, FileType2, Download, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import Papa from "papaparse";
import * as XLSX from "xlsx";

export default function Settings() {
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const normalizeKey = (key: string) => {
    return key.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  };

  const findValue = (row: Record<string, string>, possibleMatches: string[]) => {
    const keys = Object.keys(row);
    for (const match of possibleMatches) {
      const exactKey = keys.find(k => k === match);
      if (exactKey && row[exactKey] !== undefined && row[exactKey] !== "") return String(row[exactKey]).trim();
    }
    for (const match of possibleMatches) {
      const partialKey = keys.find(k => k.includes(match));
      if (partialKey && row[partialKey] !== undefined && row[partialKey] !== "") return String(row[partialKey]).trim();
    }
    return null;
  };

  // Motor de Processamento Raio-X (Lê direto do ERP)
  const process2DArray = async (rawRows: any[][]) => {
    try {
      setProgress(10);
      
      const normalizedRows = rawRows.map(row => {
        if (row.length === 1 && typeof row[0] === 'string' && row[0].includes(';')) {
          return row[0].split(';');
        }
        return row;
      });
      
      setProgress(20);

      // Busca clientes existentes para evitar duplicatas
      const { data: existingStores } = await supabase.from('stores').select('id, code, cnpj, name');
      const existingMap = new Map();
      
      if (existingStores) {
        existingStores.forEach(store => {
          const safeName = (store.name || "").toLowerCase().trim();
          if (store.code && safeName) existingMap.set(`code_name:${store.code}_${safeName}`, store.id);
          if (store.cnpj && safeName) existingMap.set(`cnpj_name:${store.cnpj}_${safeName}`, store.id);
        });
      }

      setProgress(30);

      const storesToUpsert = [];
      const seenInFile = new Set();
      
      // Tenta achar cabeçalho caso não seja o formato padrão do ERP
      let headerRowIndex = -1;
      let headers: string[] = [];
      
      for (let i = 0; i < Math.min(50, normalizedRows.length); i++) {
        const row = normalizedRows[i];
        if (!row || !Array.isArray(row)) continue;
        const rowString = row.join(" ").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (rowString.includes("nome") || rowString.includes("fantasia") || rowString.includes("cnpj")) {
          headerRowIndex = i;
          headers = row.map(h => normalizeKey(String(h || "")));
          break;
        }
      }

      // Processa linha por linha
      for (let i = 0; i < normalizedRows.length; i++) {
        if (i === headerRowIndex) continue; // Pula o cabeçalho se existir

        const rowArray = normalizedRows[i];
        if (!rowArray || rowArray.every(cell => cell === null || cell === undefined || cell === "")) continue;

        const col0 = String(rowArray[0] || "").trim();
        const col3 = String(rowArray[3] || "").trim();
        const cleanCnpj = col3.replace(/\D/g, '');

        // FINGERPRINT DO SEU ERP: Se a coluna 0 tem algo e a coluna 3 é um CNPJ (14 números), é uma loja!
        const isErpFormat = (col0.length > 0) && (cleanCnpj.length === 14);

        let storeData: any = null;

        if (isErpFormat) {
          // Mapeamento Direto (Ignora cabeçalhos e pega pela posição exata do seu print)
          storeData = {
            code: col0,
            corporate_name: String(rowArray[1] || "").trim(),
            name: String(rowArray[2] || "").trim() || String(rowArray[1] || "").trim(),
            cnpj: col3,
            address: String(rowArray[4] || "").trim(),
            state: String(rowArray[5] || "").trim(),
            neighborhood: String(rowArray[6] || "").trim(),
            zip_code: String(rowArray[7] || "").trim(),
            brand: String(rowArray[8] || "").trim() || 'Sem Grupo',
            email: String(rowArray[9] || "").trim(),
            phone: String(rowArray[10] || "").trim(),
          };
        } else if (headerRowIndex !== -1) {
          // Fallback: Se não for o formato do ERP, tenta ler pelo cabeçalho
          const rowObj: Record<string, string> = {};
          headers.forEach((header, index) => {
            if (header) rowObj[header] = String(rowArray[index] || "").trim();
          });

          const name = findValue(rowObj, ['nome fantasia', 'fantasia', 'nome', 'loja', 'cliente']);
          const corporateName = findValue(rowObj, ['razao', 'social', 'empresa']);
          const code = findValue(rowObj, ['codigo', 'cod', 'id', 'numero']);
          const cnpj = findValue(rowObj, ['cnpj', 'documento', 'cgc']);
          
          let storeName = name || corporateName;
          if (!storeName && (code || cnpj)) storeName = `Cliente sem nome (${code || cnpj})`;

          if (storeName) {
            storeData = {
              code: code,
              corporate_name: corporateName,
              name: storeName,
              cnpj: cnpj,
              address: findValue(rowObj, ['endereco', 'rua', 'logradouro', 'local']),
              state: findValue(rowObj, ['uf', 'estado', 'cidade', 'municipio']),
              neighborhood: findValue(rowObj, ['bairro', 'distrito']),
              zip_code: findValue(rowObj, ['cep']),
              brand: findValue(rowObj, ['grupo', 'marca', 'rede', 'bandeira', 'franquia']) || 'Sem Grupo',
              email: findValue(rowObj, ['email', 'e-mail', 'correio']),
              phone: findValue(rowObj, ['fone', 'telefone', 'celular', 'contato', 'whatsapp']),
            };
          }
        }

        // Se conseguiu montar os dados da loja, prepara para salvar
        if (storeData && storeData.name) {
          const safeName = storeData.name.toLowerCase().trim();
          let existingId = null;
          
          // Verifica se já existe no banco
          if (storeData.code && existingMap.has(`code_name:${storeData.code}_${safeName}`)) {
            existingId = existingMap.get(`code_name:${storeData.code}_${safeName}`);
          } else if (storeData.cnpj && existingMap.has(`cnpj_name:${storeData.cnpj}_${safeName}`)) {
            existingId = existingMap.get(`cnpj_name:${storeData.cnpj}_${safeName}`);
          }

          if (existingId) storeData.id = existingId;

          // Evita duplicatas dentro da própria planilha
          const fileKey = `${storeData.code}_${storeData.cnpj}_${safeName}`;
          if (!seenInFile.has(fileKey)) {
            seenInFile.add(fileKey);
            storesToUpsert.push(storeData);
          }
        }
      }

      if (storesToUpsert.length === 0) {
        showError("Nenhum cliente válido encontrado na planilha.");
        setIsUploading(false);
        setProgress(0);
        return;
      }

      setProgress(50);

      // Salva no banco em lotes
      const batchSize = 100;
      for (let i = 0; i < storesToUpsert.length; i += batchSize) {
        const batch = storesToUpsert.slice(i, i + batchSize);
        const { error } = await supabase.from('stores').upsert(batch);
        if (error) throw error;
        const currentProgress = 50 + Math.floor(((i + batchSize) / storesToUpsert.length) * 50);
        setProgress(Math.min(currentProgress, 99));
      }

      setProgress(100);
      showSuccess(`${storesToUpsert.length} lojas processadas com sucesso!`);
      
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
    setProgress(5);

    const fileExt = file.name.split('.').pop()?.toLowerCase();

    if (fileExt === 'csv') {
      Papa.parse(file, {
        header: false, 
        skipEmptyLines: true,
        complete: (results) => process2DArray(results.data as any[][]),
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
          
          let rawRows: any[][] = [];
          
          for (const sheetName of workbook.SheetNames) {
            const worksheet = workbook.Sheets[sheetName];
            const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" }) as any[][];
            if (rows.length > 1) {
              rawRows = rows;
              break;
            }
          }
          
          if (rawRows.length === 0) {
            showError("O arquivo Excel parece estar vazio ou sem dados válidos.");
            setIsUploading(false);
            return;
          }
          
          process2DArray(rawRows);
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

  const downloadTemplate = () => {
    const csvContent = "data:text/csv;charset=utf-8," + 
      "Codigo,Razao Social,Nome Fantasia,CNPJ,Endereco,Cidade,Bairro,CEP,Marca,Email,Telefone\n" +
      "218750-1,VICCI MAGAZINE LTDA,VICCI MAGAZINE,43.514.370/0001-50,\"DOS EXPEDICIONARIOS, 1236\",ARUJA-SP,VILA FLORA REGINA,07400-490,KELIS STORE,VICCIMAGAZINE@GMAIL.COM,(0) 46533061";
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "modelo_importacao_clientes.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDeleteAllStores = async () => {
    if (!window.confirm("ATENÇÃO: Isso vai apagar TODOS os clientes cadastrados. Tem certeza?")) return;
    
    setIsDeleting(true);
    try {
      const { error } = await supabase.from('stores').delete().not('id', 'is', null);
      if (error) throw error;
      showSuccess("Todos os clientes foram apagados com sucesso.");
    } catch (error) {
      console.error(error);
      showError("Erro ao apagar clientes.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-4xl mx-auto pb-10">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-800">Configurações</h1>
        <p className="text-slate-500 mt-1">Gerencie as preferências e dados do sistema.</p>
      </div>

      <div className="grid gap-6">
        {/* Card de Importação */}
        <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden">
          <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                  <Database size={20} />
                </div>
                <div>
                  <CardTitle className="text-lg font-bold text-slate-800">Importar Clientes / Lojas</CardTitle>
                  <CardDescription className="text-slate-500">Faça upload de uma planilha para cadastrar ou atualizar clientes.</CardDescription>
                </div>
              </div>
              <Button variant="outline" onClick={downloadTemplate} className="hidden md:flex rounded-xl border-slate-200 text-slate-600 hover:text-blue-600 hover:bg-blue-50">
                <Download size={16} className="mr-2" /> Baixar Modelo
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6 flex gap-3">
              <AlertCircle className="text-blue-600 shrink-0 mt-0.5" size={20} />
              <div className="text-sm text-blue-800">
                <p className="font-bold mb-1">Leitor Direto de ERP Ativado!</p>
                <p className="mb-2">O sistema agora reconhece o formato exato da sua exportação. Ele não precisa mais de cabeçalhos. Se ele ver um Código na primeira coluna e um CNPJ na quarta coluna, ele já sabe o que fazer!</p>
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
                  <h3 className="text-lg font-bold text-slate-800 mb-1">Processando dados...</h3>
                  <p className="text-sm text-slate-500 mb-4">Lendo dados diretamente das colunas. Não feche a página.</p>
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
                    O sistema fará a leitura e importação automática.
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

        {/* Card de Zona de Perigo */}
        <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden border border-rose-100">
          <CardHeader className="border-b border-rose-50 bg-rose-50/30 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center">
                <AlertCircle size={20} />
              </div>
              <div>
                <CardTitle className="text-lg font-bold text-rose-800">Zona de Perigo</CardTitle>
                <CardDescription className="text-rose-600/80">Ações destrutivas para o banco de dados.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h4 className="font-bold text-slate-800">Limpar Base de Clientes</h4>
                <p className="text-sm text-slate-500">Apaga todas as lojas cadastradas. Útil se você importou uma planilha errada.</p>
              </div>
              <Button 
                variant="destructive" 
                onClick={handleDeleteAllStores}
                disabled={isDeleting}
                className="rounded-xl"
              >
                {isDeleting ? <Loader2 className="animate-spin mr-2" size={16} /> : <Trash2 className="mr-2" size={16} />}
                Apagar Todos os Clientes
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}