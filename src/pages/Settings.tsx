import React, { useState } from "react";
import { 
  User, Bell, Building, LogOut, Shield, 
  Smartphone, Image as ImageIcon, Save, ChevronRight, ShieldCheck,
  Wrench, MapPin, Play, Loader2, AlertTriangle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { showSuccess, showError } from "@/utils/toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export default function Settings() {
  const { user, profile, signOut } = useAuth();
  const [isSaving, setIsSaving] = useState(false);

  const [notifications, setNotifications] = useState(true);
  const [compressPhotos, setCompressPhotos] = useState(true);

  // Estados para a Sincronização em Massa
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncTotal, setSyncTotal] = useState(0);
  const [syncSuccess, setSyncSuccess] = useState(0);

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      showSuccess("Configurações salvas com sucesso!");
    }, 800);
  };

  // Função de delay para respeitar o limite da API do mapa (1 requisição por segundo)
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const startMassSync = async () => {
    if (!confirm("Isso vai buscar as coordenadas de todas as lojas que ainda não estão no mapa. O processo pode demorar alguns minutos. Deseja continuar?")) {
      return;
    }

    setIsSyncing(true);
    setSyncProgress(0);
    setSyncSuccess(0);

    try {
      // 1. Busca todas as lojas que NÃO têm latitude ou longitude
      const { data: storesToSync, error } = await supabase
        .from('stores')
        .select('*')
        .or('lat.is.null,lng.is.null');

      if (error) throw error;

      if (!storesToSync || storesToSync.length === 0) {
        showSuccess("Todas as suas lojas já possuem coordenadas no mapa!");
        setIsSyncing(false);
        return;
      }

      setSyncTotal(storesToSync.length);
      let successCount = 0;

      // 2. Loop passando por cada loja
      for (let i = 0; i < storesToSync.length; i++) {
        const store = storesToSync[i];
        setSyncProgress(i + 1);

        try {
          let lat = null;
          let lng = null;
          let query = "";

          // Tenta pelo CEP primeiro
          if (store.zip_code) {
            const cleanCep = store.zip_code.replace(/\D/g, '');
            if (cleanCep.length === 8) {
              const viaCepRes = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
              const viaCepData = await viaCepRes.json();
              
              if (!viaCepData.erro) {
                const numeroMatch = store.address?.match(/\d+/);
                const numero = numeroMatch ? numeroMatch[0] : '';
                const ruaComNumero = numero ? `${viaCepData.logradouro}, ${numero}` : viaCepData.logradouro;
                query = `${ruaComNumero}, ${viaCepData.localidade}, ${viaCepData.uf}, Brasil`;
              }
            }
          }

          // Se não achou pelo CEP, tenta pelo endereço
          if (!query && store.address && store.state) {
            const cleanAddress = store.address.split(',')[0].split('-')[0].trim();
            query = `${cleanAddress}, ${store.neighborhood ? store.neighborhood + ',' : ''} ${store.state}, Brasil`;
          }

          // Faz a busca no mapa
          if (query) {
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`);
            const nominatimData = await res.json();
            
            if (nominatimData && nominatimData.length > 0) {
              lat = parseFloat(nominatimData[0].lat);
              lng = parseFloat(nominatimData[0].lon);
            }
          }

          // Se encontrou, salva no banco
          if (lat && lng) {
            await supabase.from('stores').update({ lat, lng }).eq('id', store.id);
            successCount++;
            setSyncSuccess(successCount);
          }
        } catch (err) {
          console.error(`Erro ao sincronizar loja ${store.id}`, err);
        }

        // Aguarda 1.5 segundos antes da próxima para não ser bloqueado pela API do mapa
        await delay(1500);
      }

      showSuccess(`Sincronização concluída! ${successCount} lojas foram adicionadas ao mapa.`);
    } catch (error) {
      console.error(error);
      showError("Ocorreu um erro ao iniciar a sincronização.");
    } finally {
      setIsSyncing(false);
    }
  };

  // Pega as iniciais do email para o avatar
  const initials = user?.email ? user.email.substring(0, 2).toUpperCase() : "US";
  const roleDisplay = profile?.role === 'admin' ? 'Administrador' : 'Instalador';

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-800">Configurações</h1>
        <p className="text-slate-500 mt-1">Gerencie sua conta e preferências do sistema.</p>
      </div>

      <Tabs defaultValue="account" className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-6 rounded-xl p-1 bg-slate-200/50 overflow-x-auto">
          <TabsTrigger value="account" className="rounded-lg font-medium flex items-center gap-2">
            <User size={16} className="hidden sm:block" /> Conta
          </TabsTrigger>
          <TabsTrigger value="app" className="rounded-lg font-medium flex items-center gap-2">
            <Smartphone size={16} className="hidden sm:block" /> App
          </TabsTrigger>
          <TabsTrigger value="company" className="rounded-lg font-medium flex items-center gap-2">
            <Building size={16} className="hidden sm:block" /> Empresa
          </TabsTrigger>
          <TabsTrigger value="tools" className="rounded-lg font-medium flex items-center gap-2">
            <Wrench size={16} className="hidden sm:block" /> Ferramentas
          </TabsTrigger>
        </TabsList>

        {/* ABA: MINHA CONTA */}
        <TabsContent value="account" className="space-y-6">
          <Card className="border-none shadow-sm rounded-2xl bg-white">
            <CardHeader className="border-b border-slate-100 pb-4">
              <CardTitle className="text-lg flex items-center gap-2 text-slate-800">
                <User size={20} className="text-blue-600" /> Perfil do Usuário
              </CardTitle>
              <CardDescription>Informações da sua conta de acesso.</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xl font-bold shadow-sm">
                  {initials}
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                    {profile?.first_name ? `${profile.first_name} ${profile.last_name || ''}` : 'Usuário'}
                    {profile?.role === 'admin' && (
                      <span className="bg-blue-100 text-blue-700 text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                        <ShieldCheck size={10} /> Admin
                      </span>
                    )}
                  </h3>
                  <p className="text-slate-500 text-sm">{user?.email}</p>
                  <p className="text-slate-400 text-xs mt-1 capitalize">Cargo: {roleDisplay}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-slate-600">E-mail de Acesso</label>
                  <Input value={user?.email || ''} type="email" className="h-11 rounded-xl bg-slate-50 border-slate-200" disabled />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm rounded-2xl bg-white">
            <CardHeader className="border-b border-slate-100 pb-4">
              <CardTitle className="text-lg flex items-center gap-2 text-slate-800">
                <Shield size={20} className="text-slate-600" /> Segurança
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="p-4 flex items-center justify-between border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer">
                <div>
                  <p className="font-bold text-slate-800">Alterar Senha</p>
                  <p className="text-sm text-slate-500">Atualize sua senha de acesso regularmente.</p>
                </div>
                <ChevronRight size={20} className="text-slate-400" />
              </div>
              <div 
                onClick={signOut}
                className="p-4 flex items-center justify-between hover:bg-red-50 transition-colors cursor-pointer group rounded-b-2xl"
              >
                <div>
                  <p className="font-bold text-red-600 group-hover:text-red-700">Sair da Conta</p>
                  <p className="text-sm text-red-400">Desconectar deste dispositivo.</p>
                </div>
                <LogOut size={20} className="text-red-400 group-hover:text-red-600" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ABA: APLICATIVO */}
        <TabsContent value="app" className="space-y-6">
          <Card className="border-none shadow-sm rounded-2xl bg-white">
            <CardHeader className="border-b border-slate-100 pb-4">
              <CardTitle className="text-lg flex items-center gap-2 text-slate-800">
                <Smartphone size={20} className="text-blue-600" /> Preferências do Dispositivo
              </CardTitle>
              <CardDescription>Ajuste como o aplicativo se comporta no seu celular.</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              
              <div className="flex items-center justify-between">
                <div className="flex gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                    <Bell size={20} />
                  </div>
                  <div>
                    <p className="font-bold text-slate-800">Notificações Push</p>
                    <p className="text-sm text-slate-500">Receber alertas de novas OSs e atualizações.</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={notifications} onChange={() => setNotifications(!notifications)} />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
                    <ImageIcon size={20} />
                  </div>
                  <div>
                    <p className="font-bold text-slate-800">Otimizar Fotos (Economia de Dados)</p>
                    <p className="text-sm text-slate-500">Comprime as fotos antes do upload para economizar 4G.</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={compressPhotos} onChange={() => setCompressPhotos(!compressPhotos)} />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

            </CardContent>
          </Card>
        </TabsContent>

        {/* ABA: EMPRESA */}
        <TabsContent value="company" className="space-y-6">
          <Card className="border-none shadow-sm rounded-2xl bg-white">
            <CardHeader className="border-b border-slate-100 pb-4">
              <CardTitle className="text-lg flex items-center gap-2 text-slate-800">
                <Building size={20} className="text-blue-600" /> Dados da Empresa
              </CardTitle>
              <CardDescription>Estas informações aparecerão nos relatórios em PDF.</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              
              <div className="space-y-1.5">
                <label className="text-sm font-bold text-slate-600">Razão Social</label>
                <Input defaultValue="Cromaprint Comunicação Visual Ltda" className="h-11 rounded-xl bg-slate-50 border-slate-200" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-slate-600">CNPJ</label>
                  <Input defaultValue="00.000.000/0001-00" className="h-11 rounded-xl bg-slate-50 border-slate-200" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-slate-600">Telefone de Contato</label>
                  <Input defaultValue="(11) 99999-9999" className="h-11 rounded-xl bg-slate-50 border-slate-200" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-bold text-slate-600">Endereço Sede</label>
                <Input defaultValue="Rua Exemplo, 123 - São Paulo, SP" className="h-11 rounded-xl bg-slate-50 border-slate-200" />
              </div>

              <Button onClick={handleSave} disabled={isSaving} className="mt-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl">
                <Save size={18} className="mr-2" /> {isSaving ? "Salvando..." : "Salvar Dados"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ABA: FERRAMENTAS */}
        <TabsContent value="tools" className="space-y-6">
          <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden">
            <CardHeader className="border-b border-slate-100 pb-4 bg-slate-50/50">
              <CardTitle className="text-lg flex items-center gap-2 text-slate-800">
                <MapPin size={20} className="text-blue-600" /> Sincronização de Mapa
              </CardTitle>
              <CardDescription>Busca automática de coordenadas para lojas antigas.</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
                <div className="flex gap-3">
                  <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={20} />
                  <div>
                    <h4 className="font-bold text-amber-800">Como funciona?</h4>
                    <p className="text-sm text-amber-700 mt-1">
                      O sistema vai procurar todas as lojas que ainda não aparecem no mapa e tentar descobrir a localização delas usando o CEP e o Endereço cadastrados.
                    </p>
                    <p className="text-sm font-bold text-amber-800 mt-2">
                      Atenção: Deixe esta página aberta até o processo terminar.
                    </p>
                  </div>
                </div>
              </div>

              {isSyncing ? (
                <div className="space-y-4 bg-slate-50 p-6 rounded-xl border border-slate-200">
                  <div className="flex justify-between items-end mb-2">
                    <div>
                      <p className="font-bold text-slate-800">Sincronizando lojas...</p>
                      <p className="text-sm text-slate-500">Processando {syncProgress} de {syncTotal}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-emerald-600">{syncSuccess} encontradas</p>
                    </div>
                  </div>
                  
                  {/* Barra de Progresso Customizada */}
                  <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-600 transition-all duration-300 ease-out"
                      style={{ width: `${syncTotal > 0 ? (syncProgress / syncTotal) * 100 : 0}%` }}
                    ></div>
                  </div>
                  
                  <div className="flex items-center justify-center gap-2 text-sm text-slate-500 mt-4">
                    <Loader2 className="animate-spin" size={16} />
                    Buscando coordenadas no servidor...
                  </div>
                </div>
              ) : (
                <Button 
                  onClick={startMassSync} 
                  className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-base shadow-sm"
                >
                  <Play size={20} className="mr-2" /> Iniciar Sincronização em Massa
                </Button>
              )}

            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </div>
  );
}