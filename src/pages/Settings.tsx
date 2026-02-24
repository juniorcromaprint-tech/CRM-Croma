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

  // Motor de Processamento com Mapeamento Dinâmico
  const process2DArray = async (rawRows: any[][]) => {
    try {
      setProgress(10);
      
      // Busca clientes existentes para evitar duplicatas
      const { data: existingStores } = await supabase.from('stores').select('id, code, cnpj, name, address');
      const existingMap = new Map();
      
      if (existingStores) {
        existingStores.forEach(store => {
          const safeName = (store.name || "").toLowerCase().trim();
          const safeAddress = (store.address || "").toLowerCase().trim();
          if (store.code && safeName) existingMap.set(`code_name:${store.code}_${safeName}`, store.id);
          if (store.cnpj && safeName) existingMap.set(`cnpj_name:${store.cnpj}_${safeName}`, store.id);
          if (safeName && safeAddress) existingMap.set(`name_address:${safeName}_${safeAddress}`, store.id);
        });
      }

      setProgress(30);

      const storesMapToUpsert = new Map();
      
      let headerRowIndex = -1;
      let colMap = {
        code: -1, corporate_name: -1, name: -1, cnpj: -1,
        address: -1, state: -1, neighborhood: -1, zip_code: -1,
        brand: -1, email: -1, phone: -1
      };

      // 1. Encontrar o cabeçalho e mapear as colunas exatas
      for (let i = 0; i < Math.min(50, rawRows.length); i++) {
        const row = rawRows[i];
        if (!Array.isArray(row)) continue;
        const rowStr = row.join(" ").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        
        if (rowStr.includes("cnpj") && (rowStr.includes("razao") || rowStr.includes("nome") || rowStr.includes("fantasia"))) {
          headerRowIndex = i;
          row.forEach((cell, index) => {
            const val = String(cell || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
            if (val === "codigo" || val === "cod" || val === "id") colMap.code = index;
            else if (val.includes("razao") || val.includes("social")) colMap.corporate_name = index;
            else if (val.includes("fantasia") || val === "nome" || val === "loja") colMap.name = index;
            else if (val === "cnpj" || val.includes("documento")) colMap.cnpj = index;
            else if (val.includes("endereco") || val.includes("rua") || val.includes("logradouro")) colMap.address = index;
            else if (val === "uf" || val.includes("estado") || val.includes("cidade")) colMap.state = index;
            else if (val.includes("bairro") || val.includes("distrito")) colMap.neighborhood = index;
            else if (val.includes("cep")) colMap.zip_code = index;
            else if (val.includes("grupo") || val.includes("marca") || val.includes("rede")) colMap.brand = index;
            else if (val.includes("email") || val.includes("e-mail")) colMap.email = index;
            else if (val.includes("fone") || val.includes("telefone") || val.includes("celular")) colMap.phone = index;
          });
          break;
        }
      }

      // 2. Processar TODAS as linhas usando o mapa de colunas
      for (let i = 0; i < rawRows.length; i++) {
        if (i === headerRowIndex) continue;
        const rowArray = rawRows[i];
        if (!rowArray || !Array.isArray(rowArray) || rowArray.length === 0) continue;
        
        // Pula linhas completamente vazias
        if (rowArray.every(cell => cell === null || cell === undefined || cell === "")) continue;

        let storeData: any = null;
        const getVal = (idx: number) => idx !== -1 && rowArray[idx] !== undefined ? String(rowArray[idx]).trim() : "";

        // Tenta usar o mapeamento de colunas primeiro (Mais seguro para XLSX)
        if (headerRowIndex !== -1 && (colMap.name !== -1 || colMap.corporate_name !== -1 || colMap.cnpj !== -1)) {
          const nameVal = getVal(colMap.name);
          const corpVal = getVal(colMap.corporate_name);
          const cnpjVal = getVal(colMap.cnpj);

          // Se tem pelo menos o nome ou CNPJ, é uma loja válida
          if (nameVal || corpVal || cnpjVal) {
            storeData = {
              code: getVal(colMap.code),
              corporate_name: corpVal,
              name: nameVal || corpVal || `Loja ${cnpjVal}`,
              cnpj: cnpjVal,
              address: getVal(colMap.address),
              state: getVal(colMap.state),
              neighborhood: getVal(colMap.neighborhood),
              zip_code: getVal(colMap.zip_code),
              brand: getVal(colMap.brand) || 'Sem Grupo',
              email: getVal(colMap.email).replace(/<br>/gi, ' / '),
              phone: getVal(colMap.phone).replace(/<br>/gi, ' / '),
            };
          }
        }

        // Fallback: Âncora de CNPJ se o mapeamento falhar
        if (!storeData || (!storeData.name && !storeData.cnpj)) {
          let cnpjIndex = -1;
          let cleanCnpj = "";
          for (let j = 0; j < rowArray.length; j++) {
            const cellStr = String(rowArray[j] || "").trim();
            const digits = cellStr.replace(/\D/g, '');
            if (digits.length === 14 && (cellStr.includes('/') || cellStr.includes('-') || cellStr.includes('.'))) {
              cnpjIndex = j;
              cleanCnpj = digits;
              break;
            }
          }

          if (cnpjIndex !== -1) {
            const nameVal = cnpjIndex >= 1 ? String(rowArray[cnpjIndex - 1] || "").trim() : "";
            const corpNameVal = cnpjIndex >= 2 ? String(rowArray[cnpjIndex - 2] || "").trim() : "";
            storeData = {
              code: cnpjIndex >= 3 ? String(rowArray[cnpjIndex - 3] || "").trim() : "",
              corporate_name: corpNameVal,
              name: nameVal || corpNameVal || `Loja ${cleanCnpj}`,
              cnpj: String(rowArray[cnpjIndex] || "").trim(),
              address: String(rowArray[cnpjIndex + 1] || "").trim(),
              state: String(rowArray[cnpjIndex + 2] || "").trim(),
              neighborhood: String(rowArray[cnpjIndex + 3] || "").trim(),
              zip_code: String(rowArray[cnpjIndex + 4] || "").trim(),
              brand: String(rowArray[cnpjIndex + 5] || "").trim() || 'Sem Grupo',
              email: String(rowArray[cnpjIndex + 6] || "").replace(/<br>/gi, ' / ').trim(),
              phone: String(rowArray[cnpjIndex + 7] || "").replace(/<br>/gi, ' / ').trim(),
            };
          }
        }

        // Se conseguiu extrair dados válidos, adiciona ao Map para salvar
        if (storeData && storeData.name) {
          const safeName = storeData.name.toLowerCase().trim();
          const safeAddress = (storeData.address || "").toLowerCase().trim();
          let existingId = null;
          
          if (storeData.code && existingMap.has(`code_name:${storeData.code}_${safeName}`)) {
            existingId = existingMap.get(`code_name:${storeData.code}_${safeName}`);
          } else if (storeData.cnpj && existingMap.has(`cnpj_name:${storeData.cnpj}_${safeName}`)) {
            existingId = existingMap.get(`cnpj_name:${storeData.cnpj}_${safeName}`);
          } else if (safeName && safeAddress && existingMap.has(`name_address:${safeName}_${safeAddress}`)) {
            existingId = existingMap.get(`name_address:${safeName}_${safeAddress}`);
          }

          if (existingId) {
            storeData.id = existingId;
            if (!storesMapToUpsert.has(existingId)) {
              storesMapToUpsert.set(existingId, storeData);
            }
          } else {
            const uniqueKey = `new_${storeData.code}_${storeData.cnpj}_${safeName}`;
            if (!storesMapToUpsert.has(uniqueKey)) {
              storesMapToUpsert.set(uniqueKey, storeData);
            }
          }
        }
      }

      const storesToUpsert = Array.from(storesMapToUpsert.values());

      if (storesToUpsert.length === 0) {
        showError("Nenhum cliente válido encontrado na planilha.");
        setIsUploading(false);
        setProgress(0);
        return;
      }

      setProgress(50);

      // Salva no banco em lotes de 100
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
      showError("Erro ao salvar os dados no banco. Verifique sua conexão.");
    } finally {
      setIsUploading(false);
      setTimeout(() => setProgress(0), 2000);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setProgress(5);

    const fileExt = file.name.split('.').pop()?.toLowerCase();

    if (fileExt === 'csv') {
      try {
        const text = await file.text();
        const semiCount = (text.match(/;/g) || []).length;
        const commaCount = (text.match(/,/g) || []).length;
        const tabCount = (text.match(/\t/g) || []).length;

        let delimiter = ',';
        if (semiCount > commaCount && semiCount > tabCount) delimiter = ';';
        else if (tabCount > commaCount && tabCount > semiCount) delimiter = '\t';

        Papa.parse(file, {
          header: false, 
          skipEmptyLines: true,
          delimiter: delimiter,
          complete: (results) => process2DArray(results.data as any[][]),
          error: (error) => {
            console.error("Erro ao ler CSV:", error);
            showError("Erro ao ler o arquivo CSV.");
            setIsUploading(false);
          }
        });
      } catch (e) {
        showError("Erro ao processar o arquivo CSV.");
        setIsUploading(false);
      }
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
                <p className="font-bold mb-1">Mapeamento Dinâmico Ativado! 🎯</p>
                <p className="mb-2">O sistema agora lê o seu arquivo XLSX, encontra onde está o cabeçalho e mapeia a posição exata de cada coluna. Isso garante que as lojas que estão nas linhas acima do cabeçalho sejam lidas perfeitamente!</p>
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
                  <p className="text-sm text-slate-500 mb-4">Mapeando colunas e extraindo lojas. Não feche a página.</p>
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