// src/routes/terceirizacaoRoutes.tsx

import { lazy } from 'react';
import { Route } from 'react-router-dom';
import LazyPage from '@/shared/components/LazyPage';
import PermissionGuard from '@/shared/components/PermissionGuard';

const TerceirizacaoPage = lazy(() => import('@/domains/terceirizacao/pages/TerceirizacaoPage'));

export const terceirizacaoRoutes = (
  <>
    <Route
      path="terceirizacao"
      element={
        <PermissionGuard module="compras" action="ver">
          <LazyPage>
            <TerceirizacaoPage />
          </LazyPage>
        </PermissionGuard>
      }
    />
  </>
);
