import React from 'react';

interface PageProps {
  children: React.ReactNode;
  className?: string;
}

export function Page({ children, className }: PageProps) {
  return (
    <div className={`flex flex-col min-h-screen pt-16 lg:pl-72 ${className || ''}`}>
      <main className="flex-1 container mx-auto p-6">
        {children}
      </main>
    </div>
  );
}