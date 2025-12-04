'use client';

import React, { useCallback, useMemo } from 'react';
import { useViewerStore, getLayoutDimensions } from '@/lib/store/useViewerStore';
import { useCameraStore } from '@/lib/store/useCameraStore';
import { Viewport } from './Viewport';
import { cn } from '@/lib/utils';

export function MultiViewer() {
  const viewerStore = useViewerStore();
  const cameraStore = useCameraStore();

  const { layout, viewports, activeViewportId, fullscreenViewportId } = viewerStore;
  const { cols, rows } = useMemo(() => getLayoutDimensions(layout), [layout]);

  const handleActivateViewport = useCallback(
    (viewportId: string) => {
      viewerStore.setActiveViewport(viewportId);
    },
    [viewerStore]
  );

  const handleDoubleClick = useCallback(
    (viewportId: string) => {
      viewerStore.toggleFullscreen(viewportId);
    },
    [viewerStore]
  );

  // Auto-assign cameras to viewports if not set
  React.useEffect(() => {
    const cameras = cameraStore.cameras;
    viewports.forEach((viewport, index) => {
      if (!viewport.cameraId && cameras[index]) {
        viewerStore.setViewportCamera(viewport.id, cameras[index].id);
      }
    });
  }, [cameraStore.cameras, viewports, viewerStore]);

  // If fullscreen, only show that viewport
  if (fullscreenViewportId) {
    const viewport = viewports.find((v) => v.id === fullscreenViewportId);
    if (viewport) {
      const camera = cameraStore.cameras.find((c) => c.id === viewport.cameraId);
      return (
        <div className="w-full h-full p-1">
          <Viewport
            viewportId={viewport.id}
            camera={camera || null}
            isActive={true}
            onActivate={() => handleActivateViewport(viewport.id)}
            onDoubleClick={() => handleDoubleClick(viewport.id)}
          />
        </div>
      );
    }
  }

  return (
    <div
      className="w-full h-full p-1 gap-1"
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gridTemplateRows: `repeat(${rows}, 1fr)`,
      }}
    >
      {viewports.map((viewport) => {
        const camera = cameraStore.cameras.find((c) => c.id === viewport.cameraId);
        const isActive = activeViewportId === viewport.id;

        return (
          <Viewport
            key={viewport.id}
            viewportId={viewport.id}
            camera={camera || null}
            isActive={isActive}
            onActivate={() => handleActivateViewport(viewport.id)}
            onDoubleClick={() => handleDoubleClick(viewport.id)}
          />
        );
      })}
    </div>
  );
}
