'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef } from 'react';
import { Header } from '@/components/layout/Header';
import { LeftPanel } from '@/components/layout/LeftPanel';
import { Timeline } from '@/components/layout/Timeline';
import { useProjectStore } from '@/lib/store/useProjectStore';
import { useCameraStore } from '@/lib/store/useCameraStore';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

// Dynamic import for MultiViewer to avoid SSR issues with Three.js
const MultiViewer = dynamic(
  () => import('@/components/viewer/MultiViewer').then((mod) => mod.MultiViewer),
  { ssr: false }
);

export default function Home() {
  const project = useProjectStore((state) => state.project);
  const newProject = useProjectStore((state) => state.newProject);
  const addCamera = useCameraStore((state) => state.addCamera);
  const cameras = useCameraStore((state) => state.cameras);
  const initializedRef = useRef(false);

  // Initialize project and cameras only once on first mount (not on navigation)
  useEffect(() => {
    // Skip if already initialized or if project exists (navigating back from layout-editor)
    if (initializedRef.current || project) {
      return;
    }
    initializedRef.current = true;

    // Only create new project if none exists
    newProject('New Project');

    // Add default cameras if none exist (check after a small delay to let socket sync)
    setTimeout(() => {
      const currentCameras = useCameraStore.getState().cameras;
      if (currentCameras.length === 0) {
        addCamera({ name: 'Camera 1', position: { x: 5, y: 2, z: 5 } });
        addCamera({ name: 'Camera 2', position: { x: -5, y: 2, z: 5 } });
        addCamera({ name: 'Camera 3', position: { x: 0, y: 5, z: 8 } });
        addCamera({ name: 'Camera 4', position: { x: 0, y: 1, z: -5 } });
      }
    }, 100);
  }, [project, newProject, addCamera]);

  // Enable keyboard shortcuts
  useKeyboardShortcuts();

  return (
    <div className="h-screen w-screen flex flex-col bg-zinc-950 text-white overflow-hidden">
      {/* Header */}
      <Header />

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel */}
        <LeftPanel />

        {/* Viewer Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Multi-Viewer */}
          <div className="flex-1 overflow-hidden">
            <MultiViewer />
          </div>

          {/* Timeline */}
          <Timeline />
        </div>
      </div>
    </div>
  );
}
