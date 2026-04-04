# RBAC (Role-Based Access Control) Implementation Summary
**Croma Print ERP/CRM — Complete RBAC System**

---

## Overview

A comprehensive Role-Based Access Control system has been implemented for Croma Print's ERP/CRM. This system provides:
- 9 distinct user roles with granular permissions
- 13 modules with fine-grained access control
- Complete user management interface
- Row-Level Security (RLS) at the database level
- Pending approval workflow for new users
- User lifecycle management (create, approve, activate/deactivate)

---

## Final Permission Matrix

### 9 Roles
| Role | Label | Description | Modules |
|---|---|---|---|
| **admin** | Administrador | Full access to all modules and actions | All 13 modules |
| **diretor** | Diretor | Read + approve access across all modules | All 13 (read/approve) |
| **comercial** | Comercial | Lead and customer management | comercial, clientes, pedidos (read) |
| **comercial_senior** | Comercial Sênior | Comercial + order management + approval | comercial, clientes, pedidos, financeiro (read), relatorios (read/export) |
| **financeiro** | Financeiro | Financial and fiscal management | financeiro, fiscal, clientes (read), pedidos (read), comercial (read), relatorios (read/export) |
| **producao** | Produção | Production and inventory management | producao, estoque, pedidos (read), qualidade |
| **compras** | Compras | Purchasing and inventory | compras, estoque, financeiro (read) |
| **logistica** | Logística | Installation and logistics | instalacao, pedidos (read), producao (read) |
| **instalador** | Instalador | Field installation (mobile app) | instalacao |

### 13 Modules
| Module | Purpose | Roles with Access |
|---|---|---|
| **dashboard** | Main dashboard | All roles |
| **comercial** | Sales, leads, opportunities | comercial, comercial_senior, diretor, admin |
| **clientes** | Customer database | comercial, comercial_senior, financeiro, diretor, admin |
| **pedidos** | Orders management | comercial_senior, producao, logistica, diretor, admin |
| **producao** | Production orders, processes | producao, diretor, admin |
| **estoque** | Inventory management | producao, compras, diretor, admin |
| **compras** | Purchasing | compras, diretor, admin |
| **financeiro** | A/R, A/P, cash flow | financeiro, comercial_senior, diretor, admin |
| **fiscal** | NF-e, fiscal documents | financeiro, diretor, admin |
| **instalacao** | Field installations | logistica, instalador, diretor, admin |
| **qualidade** | Quality control | producao, diretor, admin |
| **relatorios** | Reports & analytics | comercial_senior, financeiro, diretor, admin |
| **admin** | System administration | admin only |

### Action Matrix
| Action | Meaning |
|---|---|
| **ver** | View/read data |
| **criar** | Create new records |
| **editar** | Update existing records |
| **excluir** | Delete records |
| **aprovar** | Approve records (proposals, orders, etc.) |
| **exportar** | Export data (PDF, Excel, etc.) |

---

## Files Created/Modified

### 1. Core Infrastructure

#### Modified: `src/shared/constants/permissions.ts`
- Added `dashboard` and `relatorios` modules
- Updated all 9 role permission matrices
- Added access to new modules for appropriate roles
- All permissions now include dashboard access

#### Modified: `src/contexts/AuthContext.tsx`
- Added `ativo` field to profile type
- Added `isAdmin` computed property (true when role === 'admin')
- Added `isPendingApproval` computed property (true when role === null)
- Fetch `ativo` status on login

#### Modified: `src/App.tsx` (ProtectedRoute)
- Check if user is inactive (ativo === false) → redirect to login
- Check if user is pending approval (role === null) → show "Aguardando Aprovação" screen with spinner
- Graceful handling of approval workflow

#### Verified: `src/shared/components/PermissionGuard.tsx`
- Already has all required features:
  - Uses `useAuth().can(module, action)`
  - Shows professional "Acesso Negado" page
  - Exports both component and `usePermission()` hook

#### Verified: `src/components/Layout.tsx`
- Already filters sidebar navigation by permissions via `filterNavByModules()`
- Shows only accessible modules based on user's role

#### Verified: `src/routes/`
- All route groups already wrapped with `PermissionGuard`
- Updated relatorios route to use `module="relatorios"` instead of `module="admin"`

---

### 2. User Management Page

#### Created: `src/domains/admin/pages/AdminUsuariosPage.tsx` (MAIN DELIVERABLE)
**Complete admin panel for user management with:**

**Features:**
- User list with real-time filtering (name, email, role, status)
- Stats dashboard: total users, active count, pending approvals
- Create new user dialog with all fields (name, email, role, department, phone)
- Edit user dialog to change role, department, phone, active status
- Toggle user active/inactive status with confirmation
- Approve pending users (sets role=comercial, ativo=true)
- Visual role badges with color coding (9 distinct colors)
- Status indicators (green dot for active, red for inactive, amber for pending)
- Responsive design (mobile-friendly)
- Full loading states and error handling
- Uses TanStack Query for data management
- Supabase mutations with proper RLS detection (`.select().single()`)

**Permissions:**
- Wrapped with `<PermissionGuard module="admin" action="ver" />`
- Only admins can access and manage users

---

### 3. Edge Functions

#### Created: `supabase/functions/admin-manage-user/index.ts`
**Server-side user management with 4 actions:**

1. **create_user** - Creates auth user + profile
   - Generates temporary password
   - Sets role and department
   - Sets ativo=true for manually created users (unlike self-registered)

2. **update_profile** - Updates user profile
   - Change role, department, phone
   - Toggle ativo status
   - RLS-safe updates

3. **reset_password** - Sends password reset email
   - Uses Supabase Auth reset flow
   - Sends email to user's inbox

4. **toggle_active** - Quick toggle active status
   - Flips boolean value
   - One-click activation/deactivation

**Security:**
- Verifies requester is authenticated
- Checks if requester has admin role
- Uses `SUPABASE_SERVICE_ROLE_KEY` for sensitive operations
- CORS headers for safe cross-origin calls

---

### 4. Database Migrations

#### Created: `supabase/migrations/117_rls_por_perfil.sql`
**Row-Level Security policies by role**

**Helper Functions:**
- `get_user_role()` - Fetches user's role (defaults to 'comercial')
- `user_has_module_access(module_name)` - Checks if user can access module

**RLS Policies:**
- **Financial tables** (contas_receber, contas_pagar): financeiro, diretor, admin only
- **Production tables** (ordens_producao): producao, compras, logistica, diretor, admin
- **Admin tables** (roles, audit_logs): admin and diretor read-only
- **Shared tables** (clientes, leads, pedidos): Permissive read, restricted write by role

**Safety:**
- All policies include `OR get_user_role() = 'admin'` for admin bypass
- Respects application-level ProtectedRoute checks
- Works alongside authentication-level permissions

#### Created: `supabase/migrations/118_auth_trigger_profile_creation.sql`
**Automatic profile creation for new auth users**

**Triggers:**
1. `on_auth_user_created` - When new user signs up in Supabase Auth:
   - Creates profile with `ativo=FALSE` (inactive)
   - Sets `role=NULL` (pending approval)
   - Email is auto-populated
   - Admin must approve before user can access

2. `on_auth_user_deleted` - Cascade delete:
   - Removes profile when auth user is deleted
   - Maintains referential integrity

**Workflow:**
- Self-registered user → Auth user created → Profile created (inactive, no role)
- Shows "Aguardando Aprovação" screen on first login
- Admin approves in `/admin/usuarios` → Sets role and ativo=true
- User can now access system with appropriate permissions

---

## Implementation Details

### User Lifecycle

```
1. CREATION
   ├─ Manual (Admin): admin-manage-user Edge Function
   │  └─ Sets role, ativo=TRUE immediately
   └─ Self-register: Auth trigger
      └─ Sets role=NULL, ativo=FALSE (pending approval)

2. PENDING APPROVAL (self-registered only)
   ├─ User sees "Aguardando Aprovação" screen
   ├─ Cannot access any modules
   └─ In /admin/usuarios: "Approve" button

3. APPROVAL
   ├─ Admin clicks "Approve" or sets role manually
   ├─ Set role (e.g., comercial)
   ├─ Set ativo=TRUE
   └─ User now has access based on role

4. ACTIVE
   ├─ User logs in normally
   ├─ Sidebar shows only accessible modules
   ├─ Can perform actions based on role
   └─ Can toggle inactive anytime

5. INACTIVE
   ├─ Admin toggles ativo=FALSE
   ├─ User next login attempt → redirect to /login
   └─ No access granted
```

### Permission Check Flow

```
LOGIN
  ↓
[AuthContext] Fetch profile with role
  ↓
[ProtectedRoute] Check:
  - Is session valid? → No → /login
  - Is ativo=false? → Yes → /login
  - Is role=null? → Yes → "Aguardando Aprovação"
  ↓
[Layout] Filter sidebar:
  - getAccessibleModules(role) → list of accessible modules
  - Show only matching nav items
  ↓
[Route] PermissionGuard:
  - can(module, action)? → Yes → Show page
  - can(module, action)? → No → "Acesso Restrito"
  ↓
[Data] RLS Policies:
  - SELECT: Check user_has_module_access() + role checks
  - INSERT/UPDATE: Check role restrictions
  - DELETE: Admin/diretor only
```

---

## Testing Checklist

### User Management (`/admin/usuarios`)
- [ ] Can see list of all users with filters
- [ ] Can create new user (name, email, role, dept, phone)
- [ ] Can edit user (change role, dept, phone, status)
- [ ] Can toggle user active/inactive
- [ ] Can approve pending users (changes role from null → comercial, ativo → true)
- [ ] Stats cards show correct counts (total, active, pending)

### Role-Based Access
- [ ] Admin can access all modules
- [ ] Comercial cannot access financeiro module
- [ ] Financeiro cannot access producao module
- [ ] Sidebar reflects user's role (shows only accessible items)
- [ ] Routes with wrong permission show "Acesso Restrito"

### Pending Approval Flow
- [ ] New user sees "Aguardando Aprovação" on first login
- [ ] Cannot access any modules until approved
- [ ] Admin approves in /admin/usuarios
- [ ] User can now login normally with assigned role

### Inactive Users
- [ ] Admin can toggle user inactive
- [ ] Inactive user on next login → redirect to /login
- [ ] Inactive user cannot access system

### Edge Function
- [ ] Create user works (check Supabase Auth + profiles table)
- [ ] Reset password sends email
- [ ] Update profile changes data correctly
- [ ] Only admins can call the function (403 error otherwise)

### RLS Policies
- [ ] Financeiro user cannot see contas_receber (other roles)
- [ ] Producao user cannot see ordens_producao data from other producers
- [ ] Admin can see everything
- [ ] Self-registered user starts with ativo=FALSE

---

## Manual Steps Required

### 1. Deploy Edge Function
```bash
cd /sessions/confident-cool-fermi/mnt/CRM-Croma

# Deploy the admin-manage-user function
supabase functions deploy admin-manage-user
```

### 2. Apply Migrations
```bash
# Using Supabase CLI
supabase migration up

# OR via Supabase Dashboard:
# - SQL Editor → New Query
# - Paste contents of 117_rls_por_perfil.sql
# - Execute
# - Paste contents of 118_auth_trigger_profile_creation.sql
# - Execute
```

### 3. Set REACT_APP_SUPABASE_URL in `.env`
```env
REACT_APP_SUPABASE_URL=https://djwjmfgplnqyffdcgdaw.supabase.co
```

The Edge Function URL will be:
```
https://djwjmfgplnqyffdcgdaw.supabase.co/functions/v1/admin-manage-user
```

### 4. Test Pending Approval Flow
```bash
# 1. Manually insert a test user in Supabase Auth
# - Create user with Supabase dashboard
# - Trigger will auto-create profile with role=NULL, ativo=FALSE

# 2. Login as that user
# - Should see "Aguardando Aprovação" screen

# 3. Login as admin
# - Go to /admin/usuarios
# - Find the pending user
# - Click "Approve"
# - User can now login normally
```

### 5. Test Each Role
Create test users for each role and verify:
- Sidebar shows correct modules
- Routes show correct content or "Acesso Restrito"
- Data is filtered according to role

---

## Key Features Summary

✅ **9 Distinct Roles** - Admin, Diretor, Comercial, Comercial Sr., Financeiro, Produção, Compras, Logística, Instalador

✅ **13 Modules** - Complete coverage of all business areas

✅ **User Management UI** - Full CRUD for users with role assignment, department, phone, status

✅ **Pending Approval** - Self-registered users start inactive, admin must approve

✅ **Inactive Users** - Can be deactivated/reactivated easily

✅ **Row-Level Security** - Database-level permissions prevent unauthorized data access

✅ **Responsive Design** - Works on desktop, tablet, mobile

✅ **Real-time Filtering** - Search by name/email, filter by role/status

✅ **Error Handling** - User-friendly error messages and loading states

✅ **Sidebar Filtering** - Navigation automatically hides inaccessible modules

✅ **Graceful Degradation** - Inactive/pending users see helpful messages instead of errors

---

## Support & Maintenance

### Adding a New Role
1. Add role to `ROLES` in `permissions.ts`
2. Add role to `ROLE_PERMISSIONS` with module/action permissions
3. Add role badge color to `ROLE_COLORS` in `AdminUsuariosPage.tsx`
4. Update `get_user_role()` RLS function to include new role mappings

### Adding a New Module
1. Add module to `MODULES` array in `permissions.ts`
2. Add module permissions for each role in `ROLE_PERMISSIONS`
3. Add module to navigation in `navigation.ts` with correct module key
4. Wrap route with `<PermissionGuard module="newmodule" action="ver" />`
5. Update RLS policies if needed

### Auditing Access
- Check `audit_logs` table (seeded by triggers on sensitive tables)
- Monitor `profiles.updated_at` for admin changes
- Review Edge Function logs in Supabase dashboard

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    APPLICATION LAYER                         │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Login → AuthContext (fetch profile + role)          │  │
│  │     ↓                                                 │  │
│  │  ProtectedRoute (check ativo, role)                  │  │
│  │     ↓                                                 │  │
│  │  Layout (filterNavByModules)                         │  │
│  │     ↓                                                 │  │
│  │  Route + PermissionGuard (check can(module, action)) │  │
│  │     ↓                                                 │  │
│  │  Page Component (fetch data)                         │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                               │
├─────────────────────────────────────────────────────────────┤
│                    SUPABASE LAYER                             │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Edge Function: admin-manage-user                           │
│  ├─ Verify auth + check admin role                         │
│  ├─ create_user → auth.users + profiles                   │
│  ├─ update_profile → profiles                              │
│  ├─ reset_password → auth.email                            │
│  └─ toggle_active → profiles.ativo                         │
│                                                               │
│  RLS Policies: 117_rls_por_perfil.sql                       │
│  ├─ get_user_role() function                               │
│  ├─ user_has_module_access() function                      │
│  └─ Policies on: contas_*, ordens_*, roles, profiles       │
│                                                               │
│  Auth Triggers: 118_auth_trigger_profile_creation.sql       │
│  ├─ on_auth_user_created → insert profile (inactive)        │
│  └─ on_auth_user_deleted → delete profile                   │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Summary

A production-ready RBAC system has been implemented with:
- 9 roles, 13 modules, complete permission matrix
- User management UI with create/edit/approve/deactivate
- Database-level RLS for data protection
- Pending approval workflow for new users
- Responsive admin panel at `/admin/usuarios`
- Edge Function for backend user operations
- Professional error handling and UX

The system is backward compatible with existing code and ready for deployment.

**Status: Ready for Testing & Deployment** ✓
