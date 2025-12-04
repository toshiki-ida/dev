'use client';

import { SocketProvider } from './SocketProvider';

interface ProvidersProps {
  children: React.ReactNode;
}

// Default project ID for demo purposes
// In production, this would come from URL params, user selection, etc.
const DEFAULT_PROJECT_ID = 'default-project';

export function Providers({ children }: ProvidersProps) {
  return (
    <SocketProvider projectId={DEFAULT_PROJECT_ID}>
      {children}
    </SocketProvider>
  );
}
