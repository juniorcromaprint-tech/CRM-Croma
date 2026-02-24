import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Shield, User, ShieldCheck, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { showSuccess, showError } from "@/utils/toast";

export default function Team() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  // Busca todos os perfis cadastrados
  const { data: team, isLoading } = useQuery({
    queryKey: ['team-profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('first_name');
      
      if (error) throw error;
      return data || [];
    },
    enabled: profile?.role === 'admin' // Só busca se for admin
  });

  // Mutação para alterar o cargo
  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string, newRole: string }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-profiles'] });
      showSuccess("Cargo atualizado com sucesso!");
    },
    onError: () => {
      showError("Erro ao atualizar cargo. Verifique suas permissões.");
    }
  });

  if (profile?.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Shield size={48} className="text-slate-300 mb-4" />
        <h2 className="text-2xl font-bold text-slate-800">Acesso Restrito</h2>
        <p className="text-slate-500 mt-2">Apenas administradores podem acessar a gestão de equipe.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-800">Gestão de Equipe</h1>
        <p className="text-slate-500 mt-1">Gerencie os acessos e cargos dos seus colaboradores.</p>
      </div>

      <Card className="border-none shadow-sm rounded-2xl bg-white overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="animate-spin text-blue-600" size={32} />
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {team?.map((member) => (
                <div key={member.id} className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold shrink-0 ${
                      member.role === 'admin' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {member.first_name ? member.first_name.substring(0, 2).toUpperCase() : 'US'}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                        {member.first_name} {member.last_name}
                        {member.id === profile.id && (
                          <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full uppercase tracking-wider">Você</span>
                        )}
                      </h3>
                      <p className="text-sm text-slate-500 flex items-center gap-1 mt-0.5">
                        {member.role === 'admin' ? <ShieldCheck size={14} className="text-blue-600" /> : <User size={14} />}
                        {member.role === 'admin' ? 'Administrador' : 'Instalador'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 sm:w-auto w-full">
                    <select
                      disabled={member.id === profile.id || updateRoleMutation.isPending}
                      value={member.role || 'instalador'}
                      onChange={(e) => updateRoleMutation.mutate({ userId: member.id, newRole: e.target.value })}
                      className="h-11 px-3 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-600 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-40"
                    >
                      <option value="instalador">Instalador</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}