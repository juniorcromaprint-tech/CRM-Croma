import { useAuth } from "@/contexts/AuthContext";
import { type Module, type Action } from "@/shared/constants/permissions";
import { ShieldAlert } from "lucide-react";

interface PermissionGuardProps {
  module: Module;
  action?: Action;
  children: React.ReactNode;
  /** Mensagem customizada quando acesso é negado */
  message?: string;
}

/**
 * Guarda de permissão: exibe conteúdo somente se o usuário tem permissão.
 * Quando sem permissão, mostra tela de acesso negado.
 *
 * Uso: <PermissionGuard module="admin" action="ver">...</PermissionGuard>
 *
 * Nota: usuários sem role recebem acesso de 'comercial' por segurança.
 * Para acesso admin, a role deve ser atribuída explicitamente no banco.
 */
export default function PermissionGuard({
  module,
  action = "ver",
  children,
  message,
}: PermissionGuardProps) {
  const { can, profile } = useAuth();

  // Se o usuário tem permissão, renderiza o conteúdo
  if (can(module, action)) {
    return <>{children}</>;
  }

  // Acesso negado
  const defaultMessage = `Você não tem permissão para acessar o módulo de ${module}.`;

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center max-w-md">
        <ShieldAlert size={48} className="mx-auto text-red-400 mb-4" />
        <h2 className="text-lg font-semibold text-slate-700 mb-2">
          Acesso Restrito
        </h2>
        <p className="text-sm text-slate-500 mb-4">
          {message || defaultMessage}
        </p>
        {profile?.role && (
          <p className="text-xs text-slate-400">
            Seu perfil: <strong>{profile.role}</strong>
          </p>
        )}
        <p className="text-xs text-slate-400 mt-2">
          Fale com o administrador para solicitar acesso.
        </p>
      </div>
    </div>
  );
}

/**
 * Hook para verificar permissão em código imperativo.
 * Retorna true/false sem renderizar nada.
 */
export function usePermission(module: Module, action: Action = "ver"): boolean {
  const { can } = useAuth();
  return can(module, action);
}
