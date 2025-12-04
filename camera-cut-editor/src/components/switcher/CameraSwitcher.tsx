'use client';

import React from 'react';
import { useCameraStore, useProgramCamera } from '@/lib/store/useCameraStore';
import { cn } from '@/lib/utils';

interface CameraSwitcherProps {
  className?: string;
  orientation?: 'horizontal' | 'vertical';
}

/**
 * Camera Switcher Panel - Broadcast-style switching interface
 * Allows quick switching between cameras for PGM output
 * Shows camera preview thumbnails with tally indicators
 */
export function CameraSwitcher({ className, orientation = 'horizontal' }: CameraSwitcherProps) {
  const cameras = useCameraStore((state) => state.cameras);
  const programCameraId = useCameraStore((state) => state.programCameraId);
  const setProgramCamera = useCameraStore((state) => state.setProgramCamera);
  const selectCamera = useCameraStore((state) => state.selectCamera);

  const handleCameraClick = (cameraId: string) => {
    // Set as program (live) camera
    setProgramCamera(cameraId);
    // Also select for editing
    selectCamera(cameraId);
  };

  const isHorizontal = orientation === 'horizontal';

  return (
    <div
      className={cn(
        'bg-zinc-900 p-2 rounded-lg',
        isHorizontal ? 'flex flex-row gap-2 overflow-x-auto' : 'flex flex-col gap-2 overflow-y-auto',
        className
      )}
    >
      {/* Switcher header */}
      <div className="flex items-center gap-2 px-2">
        <span className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">
          Switcher
        </span>
      </div>

      {/* Camera buttons */}
      <div
        className={cn(
          'flex gap-2',
          isHorizontal ? 'flex-row' : 'flex-col'
        )}
      >
        {cameras.map((camera, index) => {
          const isProgram = camera.id === programCameraId;
          const isEnabled = camera.enabled;

          return (
            <button
              key={camera.id}
              onClick={() => handleCameraClick(camera.id)}
              disabled={!isEnabled}
              className={cn(
                'relative flex flex-col items-center justify-center min-w-[80px] p-2 rounded transition-all',
                isProgram
                  ? 'bg-red-600 text-white ring-2 ring-red-400'
                  : isEnabled
                  ? 'bg-zinc-800 text-white hover:bg-zinc-700'
                  : 'bg-zinc-900 text-zinc-600 cursor-not-allowed',
                'focus:outline-none focus:ring-2 focus:ring-blue-500'
              )}
            >
              {/* Tally light indicator */}
              <div
                className={cn(
                  'absolute top-1 right-1 w-2 h-2 rounded-full',
                  isProgram ? 'bg-red-400 animate-pulse' : 'bg-zinc-600'
                )}
              />

              {/* Camera number */}
              <span className="text-lg font-bold">{index + 1}</span>

              {/* Camera name */}
              <span className="text-xs truncate max-w-full">{camera.name}</span>

              {/* Color indicator */}
              <div
                className="w-full h-1 rounded-full mt-1"
                style={{ backgroundColor: camera.color }}
              />
            </button>
          );
        })}
      </div>

      {/* Cut/Mix buttons */}
      <div className={cn('flex gap-2', isHorizontal ? 'ml-auto' : 'mt-auto')}>
        <button
          className="px-4 py-2 bg-red-700 hover:bg-red-600 text-white text-sm font-bold rounded transition-colors"
          onClick={() => {
            // For now, CUT is immediate (already implemented)
            // Could add transition effects later
          }}
        >
          CUT
        </button>
        <button
          className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white text-sm font-bold rounded transition-colors"
          onClick={() => {
            // Mix/Dissolve transition (future implementation)
          }}
        >
          MIX
        </button>
      </div>
    </div>
  );
}

export default CameraSwitcher;
