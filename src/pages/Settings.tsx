import React, { useState, useMemo, useEffect } from "react";
import {
  User, Bell, Building, LogOut, Shield,
  Smartphone, Image as ImageIcon, Save, ChevronRight, ShieldCheck,
  Wrench, MapPin, Play, Loader2, AlertTriangle, Filter, Eye, EyeOff, KeyRound
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { showSuccess, showError } from "@/utils/toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";

export default function Settings() {
  const { user, profile, signOut } = useAuth();
  const queryClient = useQueryClient();
  const [isSaving, setIsSaving] = useState(false);

  const [notifications, setNotifications] = useState(() => localStorage.getItem('pref_notifications') !== 'false');
  const [compressPhotos, setCompressPhotos] = useState(() => localStorage.getItem('pref_compress') !== 'false');
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Estados para a Sincronização em Massa
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncTotal, setSyncTotal] = useState(0);
  const [syncSuccess, setSyncSuccess] = useState(0);

  // Filtros de Região
  const [selectedState, setSelectedState] = useState("");
  const [selectedNeighborhood, setSelectedNeighborhood] = useState("");

  // Estados para Dados da Empresa
  const [companyData, setCompanyData] = useState({
    name: "",
    cnpj: "",
    phone: "",
    address: "",
    watermark_enabled: true
  });

  // Busca dados da empresa
  const { data: dbCompany, isLoading: isLoadingCompany } = useQuery({
    queryKey: ['company-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_settings')
        .select('*')
        .single();
      if (error) throw error;
      return data;
    }
  });

  // Atualiza o estado local quando os dados chegam do banco
  useEffect(() => {
    if (dbCompany) {
      setCompanyData({
        name: dbCompany.name || "",
        cnpj: dbCompany.cnpj || "",
        phone: dbCompany.phone || "",
        address: dbCompany.address || "",
        watermark_enabled: dbCompany.watermark_enabled ?? true
      });
    }
  }, [dbCompany]);

  // Mutação para salvar dados da empresa
  const saveCompanyMutation = useMutation({
    mutationFn: async (newData: typeof companyData) => {
      const { error } = await supabase
        .from('company_settings')
        .update(newData)
        .eq('id', dbCompany.id);
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Dados da empresa atualizados!");
      queryClient.invalidateQueries({ queryKey: ['company-settings'] });
    },
    onError: () => {
      showError("Erro ao salvar dados.");
    }
  });

  const handleSaveCompany = () => {
    saveCompanyMutation.mutate(companyData);
  };

  const toggleNotifications = () => {
    const v = !notifications;
    setNotifications(v);
    localStorage.setItem('pref_notifications', String(v));
  };

  const toggleCompressPhotos = () => {
    const v = !compressPhotos;
    setCompressPhotos(v);
    localStorage.setItem('pref_compress', String(v));
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) return showError('A senha deve ter pelo menos 6 caracteres.');
    setIsChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setIsChangingPassword(false);
    if (error) return showError('Erro ao alterar senha. Tente novamente.');
    showSuccess('Senha alterada com sucesso!');
    setNewPassword('');
    setShowPasswordForm(false);
  };

  // Busca logs de auditoria (apenas para admins)
  const { data: auditLogs, isLoading: isLoadingLogs } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*, profiles:user_id(first_name, last_name)')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: profile?.role === 'admin'
  });

  // Busca todas as lojas que AINDA NÃO TÊM coordenadas
  const { data: pendingStores, isLoading: isLoadingPending } = useQuery({
    queryKey: ['pending-sync-stores'],
    queryFn: async () => {
      let allData: any[] = [];
      let page = 0;
      const pageSize = 1000;
      
      while (true) {
        const { data, error } = await supabase
          .from('stores')
          .select('id, state, neighborhood, zip_code, address')
          .or('lat.is.null,lng.is.null')
          .range(page * pageSize, (page + 1) * pageSize - 1);
        
        if (error) throw error;
        if (!data || data.length === 0) break;
        
        allData = [...allData, ...data];
        if (data.length < pageSize) break;
        page++;
      }
      
      return allData;
    }
  });

  // Extrai os Estados únicos das lojas pendentes
  const states = useMemo(() => {
    if (!pendingStores) return [];
    const unique = new Set(pendingStores.map(s => s.state?.trim().toUpperCase()).filter(Boolean));
    return Array.from(unique).sort();
  }, [pendingStores]);

  // Extrai os Bairros únicos (baseado no estado selecionado)
  const neighborhoods = useMemo(() => {
    if (!pendingStores) return [];
    let filtered = pendingStores;
    if (selectedState) {
      filtered = pendingStores.filter(s => s.state?.trim().toUpperCase() === selectedState);
    }
    const unique = new Set(filtered.map(s => s.neighborhood?.trim()).filter(Boolean));
    return Array.from(unique).sort();
  }, [pendingStores, selectedState]);

  // Limpa o bairro se o estado mudar
  useEffect(() => {
    setSelectedNeighborhood("");
  }, [selectedState]);

  // Lojas filtradas prontas para sincronizar
  const storesToSyncFiltered = useMemo(() => {
    if (!pendingStores) return [];
    return pendingStores.filter(s => {
      const matchState = !selectedState || s.state?.trim().toUpperCase() === selectedState;
      const matchNeigh = !selectedNeighborhood || s.neighborhood?.trim() === selectedNeighborhood;
      return matchState && matchNeigh;
    });
  }, [pendingStores, selectedState, selectedNeighborhood]);

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const startMassSync = async () => {
    if (storesToSyncFiltered.length === 0) return;

    if (!confirm(`Você está prestes a buscar as coordenadas de ${storesToSyncFiltered.length} lojas. Deseja continuar?`)) {
      return;
    }

    setIsSyncing(true);
    setSyncProgress(0);
    setSyncSuccess(0);
    setSyncTotal(storesToSyncFiltered.length);

    try {
      let successCount = 0;

      for (let i = 0; i < storesToSyncFiltered.length; i++) {
        const store = storesToSyncFiltered[i];
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
      // Atualiza a lista de lojas pendentes
      queryClient.invalidateQueries({ queryKey: ['pending-sync-stores'] });
      queryClient.invalidateQueries({ queryKey: ['stores-map'] });
    } catch (error) {
      console.error(error);
      showError("Ocorreu um erro ao iniciar a sincronização.");
    } finally {
      setIsSyncing(false);
    }
  };

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
                      <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
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
              <div>
                <div
                  onClick={() => setShowPasswordForm(p => !p)}
                  className="p-4 flex items-center justify-between border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <div>
                    <p className="font-bold text-slate-800 flex items-center gap-2"><KeyRound size={16} className="text-slate-500" /> Alterar Senha</p>
                    <p className="text-sm text-slate-500">Atualize sua senha de acesso regularmente.</p>
                  </div>
                  <ChevronRight size={20} className={`text-slate-400 transition-transform ${showPasswordForm ? 'rotate-90' : ''}`} />
                </div>
                {showPasswordForm && (
                  <div className="p-4 bg-slate-50 border-b border-slate-100 space-y-3">
                    <div className="relative">
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Nova senha (mínimo 6 caracteres)"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="h-11 rounded-xl pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(p => !p)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" onClick={() => { setShowPasswordForm(false); setNewPassword(''); }} className="flex-1">Cancelar</Button>
                      <Button onClick={handleChangePassword} disabled={isChangingPassword || newPassword.length < 6} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl">
                        {isChangingPassword ? <Loader2 className="animate-spin mr-2" size={16} /> : null}
                        Salvar Nova Senha
                      </Button>
                    </div>
                  </div>
                )}
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
                  <input type="checkbox" className="sr-only peer" checked={notifications} onChange={toggleNotifications} />
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
                  <input type="checkbox" className="sr-only peer" checked={compressPhotos} onChange={toggleCompressPhotos} />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
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
              
              {isLoadingCompany ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="animate-spin text-blue-600" />
                </div>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-slate-600">Razão Social</label>
                    <Input 
                      value={companyData.name} 
                      onChange={(e) => setCompanyData({...companyData, name: e.target.value})}
                      className="h-11 rounded-xl bg-slate-50 border-slate-200" 
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-sm font-bold text-slate-600">CNPJ</label>
                      <Input 
                        value={companyData.cnpj} 
                        onChange={(e) => setCompanyData({...companyData, cnpj: e.target.value})}
                        className="h-11 rounded-xl bg-slate-50 border-slate-200" 
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-bold text-slate-600">Telefone de Contato</label>
                      <Input 
                        value={companyData.phone} 
                        onChange={(e) => setCompanyData({...companyData, phone: e.target.value})}
                        className="h-11 rounded-xl bg-slate-50 border-slate-200" 
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-slate-600">Endereço Sede</label>
                    <Input
                      value={companyData.address}
                      onChange={(e) => setCompanyData({...companyData, address: e.target.value})}
                      className="h-11 rounded-xl bg-slate-50 border-slate-200"
                    />
                  </div>

                  <div className="pt-4 border-t border-slate-100">
                    <div className="flex items-center justify-between bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                      <div className="flex gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                          <ImageIcon size={20} />
                        </div>
                        <div>
                          <p className="font-bold text-slate-800">Marca d'Água Automática</p>
                          <p className="text-sm text-slate-500">Insere Data, Hora e GPS nas fotos enviadas pelos instaladores.</p>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={companyData.watermark_enabled}
                          onChange={(e) => setCompanyData({...companyData, watermark_enabled: e.target.checked})}
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                  </div>

                  <Button
                    onClick={handleSaveCompany}
                    disabled={saveCompanyMutation.isPending}
                    className="mt-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl"
                  >
                    <Save size={18} className="mr-2" /> {saveCompanyMutation.isPending ? "Salvando..." : "Salvar Dados"}
                  </Button>
                </>
              )}
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
              <CardDescription>Busca automática de coordenadas para lojas que ainda não estão no mapa.</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              
              {isLoadingPending ? (
                <div className="flex items-center justify-center py-8 text-slate-500">
                  <Loader2 className="animate-spin mr-2" size={20} /> Carregando lojas pendentes...
                </div>
              ) : pendingStores?.length === 0 ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-center">
                  <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3">
                    <MapPin size={24} />
                  </div>
                  <h4 className="font-bold text-emerald-800 text-lg">Tudo Sincronizado!</h4>
                  <p className="text-emerald-700 mt-1">Todas as suas lojas já possuem coordenadas e estão aparecendo no mapa.</p>
                </div>
              ) : (
                <>
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 mb-6">
                    <h4 className="font-bold text-blue-800 flex items-center gap-2 mb-4">
                      <Filter size={18} /> Filtrar Lojas para Sincronizar
                    </h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold text-blue-700 mb-1 block uppercase tracking-wider">Estado (UF)</label>
                        <select 
                          className="w-full h-11 px-3 rounded-xl border border-blue-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          value={selectedState}
                          onChange={(e) => setSelectedState(e.target.value)}
                          disabled={isSyncing}
                        >
                          <option value="">Todos os Estados</option>
                          {states.map(state => (
                            <option key={state} value={state}>{state}</option>
                          ))}
                        </select>
                      </div>
                      
                      <div>
                        <label className="text-xs font-bold text-blue-700 mb-1 block uppercase tracking-wider">Bairro / Região</label>
                        <select 
                          className="w-full h-11 px-3 rounded-xl border border-blue-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                          value={selectedNeighborhood}
                          onChange={(e) => setSelectedNeighborhood(e.target.value)}
                          disabled={isSyncing || neighborhoods.length === 0}
                        >
                          <option value="">Todos os Bairros</option>
                          {neighborhoods.map(neigh => (
                            <option key={neigh} value={neigh}>{neigh}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-blue-200/50 flex items-center justify-between">
                      <span className="text-sm font-medium text-blue-800">
                        Lojas prontas para sincronizar:
                      </span>
                      <span className="text-lg font-black text-blue-700 bg-white px-3 py-1 rounded-lg shadow-sm">
                        {storesToSyncFiltered.length}
                      </span>
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
                      disabled={storesToSyncFiltered.length === 0}
                      className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-base shadow-sm disabled:opacity-50"
                    >
                      <Play size={20} className="mr-2" /> Iniciar Sincronização
                    </Button>
                  )}
                </>
              )}

            </CardContent>
          </Card>

          {profile?.role === 'admin' && (
            <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden mt-6">
              <CardHeader className="border-b border-slate-100 pb-4 bg-slate-50/50">
                <CardTitle className="text-lg flex items-center gap-2 text-slate-800">
                  <Shield size={20} className="text-blue-600" /> Logs de Auditoria
                </CardTitle>
                <CardDescription>Histórico de ações críticas realizadas no sistema.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {isLoadingLogs ? (
                  <div className="p-8 text-center text-slate-500"><Loader2 className="animate-spin mx-auto mb-2" /> Carregando logs...</div>
                ) : auditLogs?.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 italic">Nenhum log registrado ainda.</div>
                ) : (
                  <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto">
                    {auditLogs?.map((log) => (
                      <div key={log.id} className="p-4 hover:bg-slate-50 transition-colors">
                        <div className="flex justify-between items-start mb-1">
                          <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded uppercase">
                            {log.action.replace('_', ' ')}
                          </span>
                          <span className="text-xs text-slate-400 font-medium">
                            {new Date(log.created_at).toLocaleString('pt-BR')}
                          </span>
                        </div>
                        <p className="text-sm text-slate-700">
                          <span className="font-bold">{log.profiles?.first_name || 'Sistema'}</span> alterou dados na OS/Loja <span className="font-mono text-xs bg-slate-100 px-1 rounded">{log.target_id.substring(0,8)}</span>
                        </p>
                        {log.new_value?.status && (
                          <p className="text-xs text-slate-500 mt-1">
                            Status alterado para: <span className="font-bold text-slate-700">{log.new_value.status}</span>
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

      </Tabs>
    </div>
  );
}