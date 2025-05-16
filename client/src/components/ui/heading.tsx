import React, { ReactNode } from 'react';

interface HeadingProps {
  title: string;
  description?: string;
  icon?: ReactNode;
}

export function Heading({ title, description, icon }: HeadingProps) {
  return (
    <div className="flex items-start space-x-3">
      {icon && (
        <div className="mt-1 p-1.5 bg-primary/10 rounded-md text-primary">
          {icon}
        </div>
      )}
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
    </div>
  );
}