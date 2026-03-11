import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="flex min-h-screen bg-gray-900 text-white">
      <Sidebar />
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
