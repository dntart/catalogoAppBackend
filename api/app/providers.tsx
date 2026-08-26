'use client';

import type { ReactNode } from 'react';
import { AuthProvider } from '../ui/AuthContext';

/// El layout raíz (app/layout.tsx) tiene que ser un Server Component, pero
/// AuthProvider usa hooks de React (useState/useEffect) — este wrapper
/// separa esa frontera cliente/servidor sin tener que marcar todo el layout
/// como 'use client'.
export function Providers({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
