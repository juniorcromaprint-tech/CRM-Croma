import React, { useState } from "react";
import { 
  User, Bell, Building, LogOut, Shield, 
  Smartphone, Image as ImageIcon, Save, HelpCircle, ChevronRight, ShieldCheck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { showSuccess } from "@/utils/toast";
import { useAuth } from "@/contexts/AuthContext";

export default function Settings() {
  const { user, profile, signOut } = useAuth();
  const [isSaving, setIsSaving] = useState(false);

  const [notifications, setNotifications] = useState(true);
  const [compressPhotos, setCompressPhotos] = useState(true);

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      showSuccess("Configurações salvas com sucesso!");
    }, 800);
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
        <TabsList className="grid w-full grid-cols-3 mb-6 rounded-xl p-1 bg-slate-200/50">
          <TabsTrigger value="account" className="rounded-lg font-medium flex items-center gap-2">
            <User size={16} className="hidden sm:block" /> Conta
          </TabsTrigger>
          <TabsTrigger value="app" className="rounded-lg font-medium flex items-center gap-2">
            <Smartphone size={16} className="hidden sm:block" /> Aplicativo
          </TabsTrigger>
          <TabsTrigger value="company" className="rounded-lg font-medium flex items-center gap-2">
            <Building size={16} className="hidden sm:block" /> Empresa
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

      </Tabs>
    </div>
  );
}