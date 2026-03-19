import React, { useState, useEffect } from "react";
import { Save, Loader2, UserPlus, Pencil, Mail, Lock, Shield, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import { useQueryClient } from "@tanstack/react-query";

type MemberToEdit = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email?: string | null;
  role: string | null;
};

interface TeamMemberFormSheetProps {
  isOpen: boolean;
  onClose: () => void;
  memberToEdit?: MemberToEdit | null;
}

export default function TeamMemberFormSheet({ isOpen, onClose, memberToEdit }: TeamMemberFormSheetProps) {
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditing = !!memberToEdit;

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    role: "instalador"
  });

  // Preenche formulário ao editar
  useEffect(() => {
    if (memberToEdit) {
      setFormData({
        firstName: memberToEdit.first_name || "",
        lastName: memberToEdit.last_name || "",
        email: memberToEdit.email || "",
        password: "",
        role: memberToEdit.role || "instalador"
      });
    } else {
      setFormData({ firstName: "", lastName: "", email: "", password: "", role: "instalador" });
    }
  }, [memberToEdit, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleCreate = async () => {
    if (!formData.firstName || !formData.email || !formData.password) {
      showError("Preencha todos os campos obrigatórios.");
      return;
    }
    if (formData.password.length < 6) {
      showError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    const { data, error } = await supabase.functions.invoke('create-user', {
      body: formData
    });

    if (error) throw error;
    if (data?.error) throw new Error(data.error);

    showSuccess("Membro adicionado com sucesso!");
  };

  const handleEdit = async () => {
    if (!formData.firstName) {
      showError("O nome é obrigatório.");
      return;
    }

    const fullName = `${formData.firstName} ${formData.lastName || ''}`.trim();
    const { error } = await supabase
      .from('profiles')
      .update({
        first_name: formData.firstName,
        last_name: formData.lastName || null,
        full_name: fullName,
        role: formData.role,
      })
      .eq('id', memberToEdit!.id);

    if (error) throw error;

    showSuccess("Membro atualizado com sucesso!");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (isEditing) {
        await handleEdit();
      } else {
        await handleCreate();
      }

      queryClient.invalidateQueries({ queryKey: ['team-profiles'] });
      onClose();
    } catch (error: any) {
      console.error(error);
      showError(error.message || "Erro ao salvar. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto p-0 bg-white">
        <div className="p-6 bg-slate-50 border-b border-slate-100 sticky top-0 z-10">
          <SheetHeader>
            <SheetTitle className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              {isEditing
                ? <><Pencil className="text-blue-600" size={24} /> Editar Membro</>
                : <><UserPlus className="text-blue-600" size={24} /> Novo Membro</>
              }
            </SheetTitle>
            <SheetDescription className="text-slate-500">
              {isEditing
                ? "Atualize as informações do colaborador."
                : "Crie uma conta de acesso para um novo instalador ou administrador."
              }
            </SheetDescription>
          </SheetHeader>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">Nome *</label>
                <Input
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  placeholder="Ex: João"
                  className="h-11 rounded-xl bg-slate-50 border-slate-200"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">Sobrenome</label>
                <Input
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  placeholder="Ex: Silva"
                  className="h-11 rounded-xl bg-slate-50 border-slate-200"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 mb-1 flex items-center gap-1">
                <Mail size={12} /> E-mail de Acesso {!isEditing && '*'}
              </label>
              <Input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="joao@empresa.com"
                className="h-11 rounded-xl bg-slate-50 border-slate-200"
                required={!isEditing}
                disabled={isEditing}
              />
              {isEditing && (
                <p className="text-[10px] text-slate-400 mt-1">O e-mail não pode ser alterado.</p>
              )}
            </div>

            {!isEditing && (
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 flex items-center gap-1">
                  <Lock size={12} /> Senha Inicial *
                </label>
                <Input
                  type="text"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Mínimo 6 caracteres"
                  className="h-11 rounded-xl bg-slate-50 border-slate-200"
                  required
                  minLength={6}
                />
                <p className="text-[10px] text-slate-400 mt-1">O usuário poderá alterar a senha depois.</p>
              </div>
            )}

            <div>
              <label className="text-xs font-bold text-slate-500 mb-1 flex items-center gap-1">
                <Shield size={12} /> Nível de Acesso *
              </label>
              <div className="relative">
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  className="w-full h-11 pl-3 pr-10 rounded-xl border border-slate-200 bg-slate-50 shadow-sm text-sm focus:ring-2 focus:ring-blue-600 focus:border-transparent appearance-none outline-none text-slate-700"
                >
                  <option value="instalador">Instalador (Acesso restrito)</option>
                  <option value="admin">Administrador (Acesso total)</option>
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 pb-8 flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1 h-12 rounded-xl border-slate-200 text-slate-600"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-sm"
            >
              {isSubmitting ? (
                <><Loader2 className="animate-spin mr-2" size={20} /> {isEditing ? 'Salvando...' : 'Criando...'}</>
              ) : (
                <><Save className="mr-2" size={20} /> {isEditing ? 'Salvar Alterações' : 'Criar Conta'}</>
              )}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
