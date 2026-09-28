'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { useAuth } from '../AuthContext';

const links = [
  { to: '/', label: 'Resumen' },
  { to: '/items', label: 'Items' },
  { to: '/operarios', label: 'Operarios' },
  { to: '/ordenes-produccion', label: 'Órdenes de producción' },
  { to: '/movimientos', label: 'Movimientos' },
];

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  const linksVisibles = user?.esSuperAdmin
    ? [...links, { to: '/admin', label: 'Admin' }]
    : links;

  return (
    <div className="min-h-screen bg-wa-bg">
      <header className="bg-wa-header">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <span className="font-semibold text-white">Textil Stock</span>
          <nav className="flex gap-4 text-sm">
            {linksVisibles.map((link) => {
              const isActive = link.to === '/' ? pathname === '/' : pathname.startsWith(link.to);
              return (
                <Link
                  key={link.to}
                  href={link.to}
                  className={isActive ? 'font-medium text-wa-green' : 'text-white/70 hover:text-white'}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-3 text-sm text-white/70">
            <span>{user?.nombre}</span>
            <button onClick={logout} className="hover:text-white">
              Salir
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}
