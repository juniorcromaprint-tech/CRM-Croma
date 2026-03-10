import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Shield, User, ShieldCheck, Loader2, Plus, Trash2, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { showSuccess, showError } from "@/utils/toast";
import TeamMemberFormSheet from "@/components/TeamMemberFormSheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type TeamMember = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  role: string | null;
  email?: string | null;
};

export default function Team() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<TeamMember | null>(null);

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

  // Mutação para excluir membro
  const deleteMemberMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.functions.invoke('delete-user', {
        body: { userId }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-profiles'] });
      showSuccess("Membro excluído com sucesso!");
      setMemberToDelete(null);
    },
    onError: (error: any) => {
      showError(error.message || "Erro ao excluir membro. Tente novamente.");
      setMemberToDelete(null);
    }
  });

  const handleDeleteClick = (member: TeamMember) => {
    setMemberToDelete(member);
  };

  const handleConfirmDelete = () => {
    if (memberToDelete) {
      deleteMemberMutation.mutate(memberToDelete.id);
    }
  };

  if (profile?.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Shield size={48} className="text-slate-300 mb-4" />
        <h2 className="text-2xl font-bold text-slate-800">Acesso Restrito</h2>
        <p className="text-slate-500 mt-2">Apenas administradores podem acessar a gestão de equipe.</p>
      </div>
    );
  }

  const getMemberDisplayName = (member: TeamMember) => {
    if (member.first_name || member.last_name) {
      return `${member.first_name || ''} ${member.last_name || ''}`.trim();
    }
    return member.full_name || 'Sem nome';
  };

  const getMemberInitials = (member: TeamMember) => {
    if (member.first_name) {
      return member.first_name.substring(0, 2).toUpperCase();
    }
    if (member.full_name) {
      return member.full_name.substring(0, 2).toUpperCase();
    }
    return 'US';
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800">Gestão de Equipe</h1>
          <p className="text-slate-500 mt-1">Gerencie os acessos e cargos dos seus colaboradores.</p>
        </div>
        <Button
          onClick={() => setIsSheetOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-11 px-5 shadow-sm w-full md:w-auto"
        >
          <Plus size={20} className="mr-2" /> Novo Membro
        </Button>
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
                      {getMemberInitials(member)}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                        {getMemberDisplayName(member)}
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
                      className="h-11 px-3 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex-1 sm:w-40"
                    >
                      <option value="instalador">Instalador</option>
                      <option value="admin">Administrador</option>
                    </select>

                    {/* Botão Excluir - só aparece se NÃO for o próprio admin */}
                    {member.id !== profile.id && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteClick(member)}
                        disabled={deleteMemberMutation.isPending}
                        className="h-11 w-11 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 shrink-0 transition-colors"
                        title="Excluir membro"
                      >
                        {deleteMemberMutation.isPending && memberToDelete?.id === member.id ? (
                          <Loader2 size={18} className="animate-spin" />
                        ) : (
                          <Trash2 size={18} />
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              ))}

              {team?.length === 0 && (
                <div className="py-12 text-center text-slate-500">
                  Nenhum membro encontrado. Adicione o primeiro membro da equipe.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <TeamMemberFormSheet
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
      />

      {/* Diálogo de Confirmação de Exclusão */}
      <AlertDialog open={!!memberToDelete} onOpenChange={(open) => !open && setMemberToDelete(null)}>
        <AlertDialogContent className="rounded-2xl max-w-md mx-4">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <AlertTriangle size={24} className="text-red-600" />
              </div>
              <AlertDialogTitle className="text-xl font-bold text-slate-800">
                Excluir Membro
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-slate-600 text-base leading-relaxed">
              Tem certeza que deseja excluir{' '}
              <strong className="text-slate-800">
                {memberToDelete ? getMemberDisplayName(memberToDelete) : ''}
              </strong>
              ? Esta ação é irreversível.
              <br /><br />
              <span className="text-sm text-slate-500">
                O acesso ao sistema será removido permanentemente.
                Jobs já concluídos serão mantidos no histórico.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3 sm:gap-3 mt-2">
            <AlertDialogCancel
              className="h-12 rounded-xl border-slate-200 text-slate-600 font-medium hover:bg-slate-50"
              disabled={deleteMemberMutation.isPending}
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={deleteMemberMutation.isPending}
              className="h-12 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold shadow-sm"
            >
              {deleteMemberMutation.isPending ? (
                <><Loader2 className="animate-spin mr-2" size={18} /> Excluindo...</>
              ) : (
                <><Trash2 className="mr-2" size={18} /> Sim, Excluir</>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}