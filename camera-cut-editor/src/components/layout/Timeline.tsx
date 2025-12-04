'use client';

import React, { useCallback, useRef, useEffect } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ChevronLeft,
  ChevronRight,
  Repeat,
  Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { useTimelineStore } from '@/lib/store/useTimelineStore';
import { useCameraStore } from '@/lib/store/useCameraStore';
import { secondsToTimecodeString } from '@/types/timeline';
import { cn } from '@/lib/utils';

export function Timeline() {
  const timelineStore = useTimelineStore();
  const cameraStore = useCameraStore();
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  // Animation loop for playback
  useEffect(() => {
    if (timelineStore.isPlaying) {
      lastTimeRef.current = performance.now();

      const animate = (now: number) => {
        const delta = (now - lastTimeRef.current) / 1000;
        lastTimeRef.current = now;

        let newTime = timelineStore.currentTime + delta;

        if (newTime >= timelineStore.duration) {
          if (timelineStore.loop) {
            newTime = 0;
          } else {
            newTime = timelineStore.duration;
            timelineStore.pause();
          }
        }

        timelineStore.setCurrentTime(newTime);

        if (timelineStore.isPlaying) {
          animationRef.current = requestAnimationFrame(animate);
        }
      };

      animationRef.current = requestAnimationFrame(animate);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [timelineStore.isPlaying, timelineStore.loop, timelineStore.duration, timelineStore]);

  const handleTimelineClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const ratio = x / rect.width;
      const newTime = ratio * timelineStore.duration;
      timelineStore.setCurrentTime(Math.max(0, Math.min(newTime, timelineStore.duration)));
    },
    [timelineStore]
  );

  const handleAddCut = useCallback(() => {
    const selectedCamera = cameraStore.selectedCameraId;
    timelineStore.addCut({
      cameraId: selectedCamera || '',
      duration: 5,
    });
  }, [timelineStore, cameraStore.selectedCameraId]);

  const currentTimecode = secondsToTimecodeString(
    timelineStore.currentTime,
    timelineStore.frameRate
  );
  const durationTimecode = secondsToTimecodeString(
    timelineStore.duration,
    timelineStore.frameRate
  );

  const progress =
    timelineStore.duration > 0
      ? (timelineStore.currentTime / timelineStore.duration) * 100
      : 0;

  return (
    <div className="h-48 bg-zinc-900 border-t border-zinc-700 flex flex-col">
      {/* Transport controls */}
      <div className="h-10 flex items-center justify-between px-4 border-b border-zinc-800">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => timelineStore.seekToStart()}
          >
            <SkipBack className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => timelineStore.prevFrame()}
          >
            <ChevronLeft className="h-3 w-3" />
          </Button>
          <Button
            variant={timelineStore.isPlaying ? 'default' : 'ghost'}
            size="icon"
            className="h-7 w-7"
            onClick={() => timelineStore.togglePlayback()}
          >
            {timelineStore.isPlaying ? (
              <Pause className="h-3 w-3" />
            ) : (
              <Play className="h-3 w-3" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => timelineStore.nextFrame()}
          >
            <ChevronRight className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => timelineStore.seekToEnd()}
          >
            <SkipForward className="h-3 w-3" />
          </Button>
          <Button
            variant={timelineStore.loop ? 'default' : 'ghost'}
            size="icon"
            className="h-7 w-7"
            onClick={() => timelineStore.setLoop(!timelineStore.loop)}
          >
            <Repeat className="h-3 w-3" />
          </Button>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-xs font-mono text-zinc-400">
            {currentTimecode} / {durationTimecode}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500">Zoom</span>
            <Slider
              value={[timelineStore.zoom]}
              min={0.5}
              max={5}
              step={0.1}
              className="w-20"
              onValueChange={([value]) => timelineStore.setZoom(value)}
            />
          </div>
          <Button variant="ghost" size="sm" className="h-7" onClick={handleAddCut}>
            <Plus className="h-3 w-3 mr-1" />
            カット追加
          </Button>
        </div>
      </div>

      {/* Timeline track */}
      <div className="flex-1 overflow-hidden">
        <div
          className="h-full relative cursor-pointer"
          onClick={handleTimelineClick}
        >
          {/* Background grid */}
          <div className="absolute inset-0 opacity-20">
            {Array.from({ length: 20 }).map((_, i) => (
              <div
                key={i}
                className="absolute top-0 bottom-0 border-l border-zinc-600"
                style={{ left: `${i * 5}%` }}
              />
            ))}
          </div>

          {/* Cuts */}
          <div className="absolute top-2 bottom-8 left-0 right-0 flex">
            {timelineStore.cuts.map((cut, index) => {
              const left =
                timelineStore.duration > 0
                  ? (cut.startTime / timelineStore.duration) * 100
                  : 0;
              const width =
                timelineStore.duration > 0
                  ? (cut.duration / timelineStore.duration) * 100
                  : 0;

              const camera = cameraStore.cameras.find(c => c.id === cut.cameraId);
              const isSelected = timelineStore.selectedCutId === cut.id;

              return (
                <div
                  key={cut.id}
                  className={cn(
                    'absolute top-0 bottom-0 rounded border cursor-pointer transition-all',
                    isSelected
                      ? 'border-emerald-400 bg-emerald-400/20'
                      : 'border-zinc-600 bg-zinc-800 hover:bg-zinc-700'
                  )}
                  style={{
                    left: `${left}%`,
                    width: `${width}%`,
                    backgroundColor: isSelected
                      ? undefined
                      : camera?.color
                        ? `${camera.color}30`
                        : undefined,
                    borderColor: camera?.color || undefined,
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    timelineStore.selectCut(cut.id);
                    timelineStore.setCurrentTime(cut.startTime);
                  }}
                >
                  <div className="p-1 text-xs truncate">
                    <div className="font-medium truncate">{cut.name}</div>
                    <div className="text-zinc-400 truncate text-[10px]">
                      {camera?.name || 'カメラ未設定'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Playhead */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-red-500 pointer-events-none z-10"
            style={{ left: `${progress}%` }}
          >
            <div className="absolute -top-0 left-1/2 -translate-x-1/2 w-3 h-3 bg-red-500 rotate-45" />
          </div>

          {/* Markers */}
          {timelineStore.markers.map((marker) => {
            const left =
              timelineStore.duration > 0
                ? (marker.time / timelineStore.duration) * 100
                : 0;
            return (
              <div
                key={marker.id}
                className="absolute top-0 w-0.5 h-3 pointer-events-auto cursor-pointer"
                style={{ left: `${left}%`, backgroundColor: marker.color }}
                title={marker.name}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
