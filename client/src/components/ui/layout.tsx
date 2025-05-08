import React from 'react';
import { Header } from '@/components/header';
import { Sidebar } from '@/components/ui/sidebar';
import { Page } from '@/components/page';

interface LayoutProps {
  children: React.ReactNode;
  title: string;
  description?: string;
}

export function Layout({ children, title, description }: LayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  
  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };
  
  return (
    <>
      <Header onToggleSidebar={toggleSidebar} />
      <Sidebar collapsed={sidebarCollapsed} onToggle={toggleSidebar} />
      <Page>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
            {description && (
              <p className="text-muted-foreground mt-1">{description}</p>
            )}
          </div>
          {children}
        </div>
      </Page>
    </>
  );
}