'use client';

import type { ReactNode } from 'react';
import { ProtectedRoute } from '../../ui/components/ProtectedRoute';
import { Layout } from '../../ui/components/Layout';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute>
      <Layout>{children}</Layout>
    </ProtectedRoute>
  );
}
