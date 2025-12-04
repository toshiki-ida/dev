'use client';

import React from 'react';
import { Camera as CameraIcon, Radio, Maximize2 } from 'lucide-react';
import { Camera } from '@/types/camera';
import { cn } from '@/lib/utils';

interface ViewportOverlayProps {
  camera: Camera | null;
  isActive: boolean;
  isProgram: boolean;
  showSafeFrames: boolean;
  aspectRatio?: string;
  onDoubleClick?: () => void;
}

export function ViewportOverlay({
  camera,
  isActive,
  isProgram,
  showSafeFrames,
  aspectRatio = '16:9',
  onDoubleClick,
}: ViewportOverlayProps) {
  return (
    <div
      className="absolute inset-0 pointer-events-none"
      onDoubleClick={(e) => {
        e.stopPropagation();
        onDoubleClick?.();
      }}
    >
      {/* Tally light */}
      {isProgram && (
        <div className="absolute top-2 right-2 flex items-center gap-1 bg-red-600 px-2 py-0.5 rounded text-xs font-bold">
          <Radio className="h-3 w-3 animate-pulse" />
          LIVE
        </div>
      )}

      {/* Active indicator */}
      {isActive && !isProgram && (
        <div className="absolute inset-0 border-2 border-emerald-400 rounded pointer-events-none" />
      )}

      {/* Camera info overlay */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CameraIcon
              className="h-3 w-3"
              style={{ color: camera?.color || '#6b7280' }}
            />
            <span className="text-xs font-medium">
              {camera?.name || 'Free View'}
            </span>
          </div>
          {camera && (
            <div className="flex items-center gap-2 text-[10px] text-zinc-400">
              <span>{camera.focalLength}mm</span>
              <span>f/{camera.aperture}</span>
              <span className="font-mono">{camera.fov.toFixed(1)}°</span>
            </div>
          )}
        </div>
      </div>

      {/* Fullscreen hint */}
      <div className="absolute top-2 left-2 opacity-0 hover:opacity-100 transition-opacity pointer-events-auto">
        <button
          className="p-1 bg-black/50 rounded hover:bg-black/70"
          onClick={(e) => {
            e.stopPropagation();
            onDoubleClick?.();
          }}
        >
          <Maximize2 className="h-3 w-3" />
        </button>
      </div>

      {/* Safe frames */}
      {showSafeFrames && (
        <>
          {/* Action safe (90%) */}
          <div
            className="absolute border border-yellow-500/30"
            style={{
              top: '5%',
              left: '5%',
              right: '5%',
              bottom: '5%',
            }}
          />
          {/* Title safe (80%) */}
          <div
            className="absolute border border-red-500/30"
            style={{
              top: '10%',
              left: '10%',
              right: '10%',
              bottom: '10%',
            }}
          />
          {/* Center crosshair */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="w-6 h-px bg-white/30" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-px h-6 bg-white/30" />
          </div>
        </>
      )}

      {/* Aspect ratio guides for non-matching aspects */}
      {aspectRatio === '2.39:1' && (
        <>
          <div className="absolute top-0 left-0 right-0 h-[12%] bg-black/50" />
          <div className="absolute bottom-0 left-0 right-0 h-[12%] bg-black/50" />
        </>
      )}
      {aspectRatio === '4:3' && (
        <>
          <div className="absolute top-0 left-0 bottom-0 w-[6%] bg-black/50" />
          <div className="absolute top-0 right-0 bottom-0 w-[6%] bg-black/50" />
        </>
      )}
    </div>
  );
}
