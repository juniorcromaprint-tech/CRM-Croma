# Padrões de Código — CRM Croma

> Carregar este arquivo apenas em tarefas de frontend/React.

## Convenções

- **Código**: TypeScript/inglês | **UI**: pt-BR em TUDO que o usuário vê
- **Cards**: `rounded-2xl` | **Inputs**: `rounded-xl`
- **Cor primária**: `bg-blue-600 hover:bg-blue-700`
- **Toasts**: `showSuccess()` / `showError()` de `@/utils/toast.ts`
- **Formatação**: `brl()`, `formatDate()` de `@/shared/utils/format.ts`
- **Supabase client**: `@/integrations/supabase/client.ts`
- **Mutations**: TODO insert/update DEVE usar `.select().single()` (detectar RLS silencioso)
- **AlertDialogAction async**: SEMPRE `e.preventDefault()` + fechar dialog manualmente via `onSettled`
- **Auth**: `ProtectedRoute` obrigatório. Login em todas as rotas exceto `/p/:token` e `/nps/:token`

## Estado Vazio Padrão

```tsx
<div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
  <Icon size={40} className="mx-auto text-slate-300 mb-3" />
  <h3 className="font-semibold text-slate-600">Título</h3>
  <p className="text-sm text-slate-400 mt-1">Ação sugerida</p>
</div>
```
