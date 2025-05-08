import React from 'react';

interface PageProps {
  children: React.ReactNode;
}

export function Page({ children }: PageProps) {
  // Using the existing layout structure without requiring sidebar/nav components
  return (
    <div className="container mx-auto p-4">
      <main className="flex-1">{children}</main>
    </div>
  );
}