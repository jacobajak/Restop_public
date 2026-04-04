'use client';

import React from 'react';

interface TabsProps {
  children: React.ReactNode;
}

interface TabsListProps {
  children: React.ReactNode;
}

interface TabsTriggerProps {
  value: string;
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
}

interface TabsContentProps {
  value: string;
  active?: boolean;
  children: React.ReactNode;
}

export const Tabs: React.FC<TabsProps> = ({ children }) => {
  return <div>{children}</div>;
};

export const TabsList: React.FC<TabsListProps> = ({ children }) => {
  return <div className="flex gap-2 mb-4 border-b">{children}</div>;
};

export const TabsTrigger: React.FC<TabsTriggerProps> = ({
  children,
  active = false,
  onClick,
}) => {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 font-medium transition border-b-2 ${
        active
          ? 'border-primary text-primary'
          : 'border-transparent text-gray-600 hover:text-gray-900'
      }`}
    >
      {children}
    </button>
  );
};

export const TabsContent: React.FC<TabsContentProps> = ({ children, active = true }) => {
  if (!active) return null;
  return <div>{children}</div>;
};
