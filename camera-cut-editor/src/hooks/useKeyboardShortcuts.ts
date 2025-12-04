'use client';

import { useEffect, useCallback } from 'react';
import { useCameraStore } from '@/lib/store/useCameraStore';
import { useViewerStore } from '@/lib/store/useViewerStore';
import { useTimelineStore } from '@/lib/store/useTimelineStore';

interface ShortcutHandlers {
  onToggleGrid?: () => void;
  onToggleSafeFrames?: () => void;
  onToggleCameraGizmos?: () => void;
  onResetCamera?: () => void;
  onFocusSelected?: () => void;
  onToggleUI?: () => void;
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers = {}) {
  const cameraStore = useCameraStore();
  const viewerStore = useViewerStore();
  const timelineStore = useTimelineStore();

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Ignore if typing in an input
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      const { key, shiftKey, ctrlKey, altKey } = event;

      // Number keys 1-9: Select camera
      if (!shiftKey && !ctrlKey && !altKey && /^[1-9]$/.test(key)) {
        const index = parseInt(key, 10) - 1;
        const cameras = cameraStore.cameras;
        if (index < cameras.length) {
          cameraStore.selectCamera(cameras[index].id);
          event.preventDefault();
        }
        return;
      }

      switch (key.toLowerCase()) {
        // Space: Set selected camera as program output
        case ' ':
          if (!ctrlKey && !altKey) {
            const selectedId = cameraStore.selectedCameraId;
            if (selectedId) {
              cameraStore.setProgramCamera(selectedId);
              event.preventDefault();
            }
          }
          break;

        // R: Reset camera
        case 'r':
          if (!shiftKey && !ctrlKey && !altKey) {
            const selectedId = cameraStore.selectedCameraId;
            if (selectedId) {
              cameraStore.resetCamera(selectedId);
              handlers.onResetCamera?.();
              event.preventDefault();
            }
          }
          break;

        // F: Focus on selected object
        case 'f':
          if (!shiftKey && !ctrlKey && !altKey) {
            handlers.onFocusSelected?.();
            event.preventDefault();
          }
          break;

        // G: Toggle grid
        case 'g':
          if (!shiftKey && !ctrlKey && !altKey) {
            viewerStore.toggleGrid();
            handlers.onToggleGrid?.();
            event.preventDefault();
          }
          break;

        // H: Toggle UI
        case 'h':
          if (!shiftKey && !ctrlKey && !altKey) {
            handlers.onToggleUI?.();
            event.preventDefault();
          }
          break;

        // S: Toggle safe frames (with Shift)
        case 's':
          if (shiftKey && !ctrlKey && !altKey) {
            viewerStore.toggleSafeFrames();
            handlers.onToggleSafeFrames?.();
            event.preventDefault();
          }
          break;

        // C: Toggle camera gizmos (with Shift)
        case 'c':
          if (shiftKey && !ctrlKey && !altKey) {
            viewerStore.toggleCameraGizmos();
            handlers.onToggleCameraGizmos?.();
            event.preventDefault();
          }
          break;

        // Playback controls
        case 'k':
          // K: Toggle playback
          if (!shiftKey && !ctrlKey && !altKey) {
            timelineStore.togglePlayback();
            event.preventDefault();
          }
          break;

        case 'j':
          // J: Previous frame
          if (!shiftKey && !ctrlKey && !altKey) {
            timelineStore.prevFrame();
            event.preventDefault();
          }
          break;

        case 'l':
          // L: Next frame
          if (!shiftKey && !ctrlKey && !altKey) {
            timelineStore.nextFrame();
            event.preventDefault();
          }
          break;

        case 'home':
          // Home: Go to start
          timelineStore.seekToStart();
          event.preventDefault();
          break;

        case 'end':
          // End: Go to end
          timelineStore.seekToEnd();
          event.preventDefault();
          break;

        // Arrow keys for timeline navigation
        case 'arrowleft':
          if (!shiftKey && !ctrlKey && !altKey) {
            timelineStore.prevFrame();
            event.preventDefault();
          }
          break;

        case 'arrowright':
          if (!shiftKey && !ctrlKey && !altKey) {
            timelineStore.nextFrame();
            event.preventDefault();
          }
          break;
      }
    },
    [cameraStore, viewerStore, timelineStore, handlers]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);
}

export function useHotkey(
  key: string,
  callback: () => void,
  modifiers: { ctrl?: boolean; shift?: boolean; alt?: boolean } = {}
) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      const matchesKey = event.key.toLowerCase() === key.toLowerCase();
      const matchesCtrl = modifiers.ctrl ? event.ctrlKey : !event.ctrlKey;
      const matchesShift = modifiers.shift ? event.shiftKey : !event.shiftKey;
      const matchesAlt = modifiers.alt ? event.altKey : !event.altKey;

      if (matchesKey && matchesCtrl && matchesShift && matchesAlt) {
        event.preventDefault();
        callback();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [key, callback, modifiers]);
}
