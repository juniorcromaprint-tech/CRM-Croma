# RBAC Implementation — Quick Reference Guide

## Quick Navigation

**Main Admin Panel:** `/admin/usuarios`
**Permissions Config:** `src/shared/constants/permissions.ts`
**Auth Logic:** `src/contexts/AuthContext.tsx`
**Sidebar Filter:** `src/components/Layout.tsx` (uses `filterNavByModules()`)

---

## 9 Roles at a Glance

| Role | Modules | Best For |
|------|---------|----------|
| 🔴 **admin** | All 13 | System administration |
| 💜 **diretor** | All (read/approve) | Executive oversight |
| 🟢 **comercial** | comercial, clientes, pedidos* | Sales team |
| 🟩 **comercial_senior** | ↑ + financeiro*, relatorios* | Senior sales |
| 🟨 **financeiro** | financeiro, fiscal, clientes*, pedidos*, comercial*, relatorios | Finance team |
| 🟠 **producao** | producao, estoque, pedidos*, qualidade | Production floor |
| 🔵 **compras** | compras, estoque, financeiro* | Procurement |
| 🔷 **logistica** | instalacao, pedidos*, producao* | Field team |
| ⚫ **instalador** | instalacao | Technicians (mobile) |

*italics = read-only access

---

## 13 Modules

```
Dashboard    (all roles can see)
├─ comercial      (sales, leads, pipeline)
├─ clientes       (customer database)
├─ pedidos        (orders)
├─ producao       (production orders)
├─ estoque        (inventory)
├─ compras        (purchasing)
├─ financeiro     (accounting, A/R, A/P)
├─ fiscal         (tax, NF-e)
├─ instalacao     (field installations)
├─ qualidade      (quality control)
├─ relatorios     (reports & analytics)
└─ admin          (system settings, users)
```

---

## Key Code Snippets

### Check Permission in Component
```tsx
import { useAuth } from "@/contexts/AuthContext";

function MyComponent() {
  const { can, isAdmin } = useAuth();

  // Check specific permission
  if (!can("pedidos", "criar")) {
    return <p>You cannot create orders</p>;
  }

  // Check if admin
  if (isAdmin) {
    // Show admin controls
  }

  return <div>Content</div>;
}
```

### Guard a Route
```tsx
<Route path="myroute" element={
  <PermissionGuard module="pedidos" action="ver">
    <LazyPage><MyPage /></LazyPage>
  </PermissionGuard>
} />
```

### Wrap Page Content
```tsx
export default function MyPage() {
  return (
    <PermissionGuard module="admin" action="ver">
      {/* page content here */}
    </PermissionGuard>
  );
}
```

### Get Accessible Modules (for custom sidebar)
```tsx
const { accessibleModules } = useAuth();
// Returns: ['comercial', 'clientes', 'pedidos', 'dashboard']
```

---

## User Lifecycle Flowchart

```
SELF-REGISTRATION (future: if enabled)
  ↓
Auth user created
  ↓
Trigger: handle_new_user()
  ↓
Profile created (ativo=FALSE, role=NULL)
  ↓
Login attempt
  ↓
ProtectedRoute checks role=NULL
  ↓
Shows "Aguardando Aprovação" screen
  ↓
Admin opens /admin/usuarios
  ↓
Clicks "Approve" button
  ↓
Edge Function: update_profile (role=comercial, ativo=TRUE)
  ↓
User logs in again
  ↓
Access granted based on role

---

MANUAL USER CREATION (by admin)
  ↓
Admin goes to /admin/usuarios
  ↓
Clicks "Novo Usuário"
  ↓
Fills form (name, email, role, dept)
  ↓
Clicks "Criar Usuário"
  ↓
Edge Function: create_user (ativo=TRUE immediately)
  ↓
User receives email with login link
  ↓
User sets password and logs in
  ↓
Full access based on assigned role

---

DEACTIVATION
  ↓
Admin toggles user "inactive" in /admin/usuarios
  ↓
ativo = FALSE in profiles
  ↓
User tries to login next time
  ↓
ProtectedRoute detects ativo=FALSE
  ↓
Redirects to /login
  ↓
No access to system
```

---

## API Reference: Edge Function

**Base URL:**
```
https://djwjmfgplnqyffdcgdaw.supabase.co/functions/v1/admin-manage-user
```

### Create User
```bash
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "create_user",
    "email": "john@company.com",
    "full_name": "John Doe",
    "role": "comercial",
    "departamento": "Comercial",
    "telefone": "(11) 99999-9999"
  }' \
  https://...
```

### Update Profile
```bash
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "update_profile",
    "user_id": "abc-123-def",
    "role": "comercial_senior",
    "departamento": "Comercial",
    "ativo": true
  }' \
  https://...
```

### Reset Password
```bash
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "reset_password",
    "email": "john@company.com"
  }' \
  https://...
```

### Toggle Active
```bash
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "toggle_active",
    "user_id": "abc-123-def"
  }' \
  https://...
```

---

## SQL Reference: RLS Functions

### Get User's Role
```sql
SELECT get_user_role();
-- Returns: 'admin' | 'comercial' | etc. | 'comercial' (default)
```

### Check Module Access
```sql
SELECT user_has_module_access('pedidos');
-- Returns: true | false
```

---

## Sidebar Filter Logic

```tsx
// In Layout.tsx
const navGroups = filterNavByModules(accessibleModules);

// Result:
// Admin sees: [PAINEL, COMERCIAL, OPERACIONAL, SUPRIMENTOS, ...]
// Comercial sees: [PAINEL, COMERCIAL]
// Financeiro sees: [PAINEL, COMERCIAL, FINANCEIRO, CONTABILIDADE]
// etc.
```

---

## Permission Matrix Syntax

```typescript
// In permissions.ts
comercial_senior: {
  comercial: ['ver', 'criar', 'editar'],      // CRUD
  clientes: ['ver', 'criar', 'editar', 'excluir'], // FULL CRUD
  pedidos: ['ver', 'criar', 'editar'],        // Partial CRUD
  financeiro: ['ver'],                        // Read only
  relatorios: ['ver', 'exportar'],            // Read + export
}

// Actions:
// 'ver'      = View/read
// 'criar'    = Create
// 'editar'   = Update
// 'excluir'  = Delete
// 'aprovar'  = Approve (for approvals)
// 'exportar' = Export (for reports)
```

---

## Common Tasks

### Add New User
1. Go to `/admin/usuarios`
2. Click "Novo Usuário"
3. Fill form (required: name, email, role)
4. Click "Criar Usuário"
5. User receives email with login link

### Approve Pending User
1. Go to `/admin/usuarios`
2. Filter by "Aguardando Aprovação"
3. Click "Aprovar" next to user
4. User can now login with assigned role

### Change User's Role
1. Go to `/admin/usuarios`
2. Click pencil icon next to user
3. Select new role from dropdown
4. Click "Salvar Alterações"
5. Changes take effect on next login

### Deactivate User
1. Go to `/admin/usuarios`
2. Click X icon (deactivate button)
3. User cannot login after that

### Create New Role
1. Add role to `ROLES` in `permissions.ts`
2. Add permissions in `ROLE_PERMISSIONS`
3. Add color in `AdminUsuariosPage.tsx` (ROLE_COLORS)
4. Update RLS functions if needed

### Create New Module
1. Add to `MODULES` in `permissions.ts`
2. Add permissions for each role in `ROLE_PERMISSIONS`
3. Add to navigation in `navigation.ts`
4. Wrap routes with `<PermissionGuard module="newmodule" />`

---

## Debugging

### User Cannot Access Route
```tsx
// Check: useAuth() output
const { can, profile, accessibleModules } = useAuth();
console.log({
  role: profile?.role,
  ativo: profile?.ativo,
  can_pedidos_ver: can("pedidos", "ver"),
  accessible_modules: accessibleModules
});
```

### RLS Blocking Query
```sql
-- Check RLS policies
SELECT * FROM pg_policies WHERE tablename = 'contas_receber';

-- Test policy function
SELECT get_user_role();

-- Test if user has access
SELECT user_has_module_access('financeiro');
```

### Pending Approval Not Working
```sql
-- Check if trigger created profile
SELECT * FROM profiles WHERE id = '<user-id>';

-- Check trigger logs
SELECT * FROM pg_stat_user_functions WHERE funcname = 'handle_new_user';
```

---

## Performance Tips

1. **RLS is applied at query time** — No extra queries needed
2. **Permission checks cached** — useMemo prevents recalculations
3. **Sidebar filtering efficient** — happens in JS, not database
4. **Edge Function minimal overhead** — Uses service role for batch operations

---

## Support

**Issues?** Check:
1. Is user `ativo = true`?
2. Does role have permission? (check ROLE_PERMISSIONS)
3. Is route wrapped with `<PermissionGuard>`?
4. Is module in MODULES array?
5. Are RLS policies applied?

---

**Last Updated:** 2026-04-04
**Status:** Ready for Production
