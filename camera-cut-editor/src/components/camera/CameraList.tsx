'use client';

import React, { useCallback } from 'react';
import {
  Plus,
  Trash2,
  Copy,
  Eye,
  EyeOff,
  Radio,
  Camera as CameraIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCameraStore, useSelectedCamera } from '@/lib/store/useCameraStore';
import { cn } from '@/lib/utils';

export function CameraList() {
  const cameras = useCameraStore((state) => state.cameras);
  const selectedCameraId = useCameraStore((state) => state.selectedCameraId);
  const programCameraId = useCameraStore((state) => state.programCameraId);
  const {
    addCamera,
    removeCamera,
    selectCamera,
    duplicateCamera,
    updateCamera,
    setProgramCamera,
  } = useCameraStore();

  const handleAddCamera = useCallback(() => {
    addCamera();
  }, [addCamera]);

  const handleToggleEnabled = useCallback(
    (id: string, enabled: boolean) => {
      updateCamera(id, { enabled: !enabled });
    },
    [updateCamera]
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
          カメラ一覧
        </h3>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={handleAddCamera}
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>

      <div className="space-y-1">
        {cameras.length === 0 ? (
          <div className="text-xs text-zinc-500 text-center py-4">
            カメラがありません
            <br />
            <button
              className="text-emerald-400 hover:underline mt-1"
              onClick={handleAddCamera}
            >
              カメラを追加
            </button>
          </div>
        ) : (
          cameras.map((camera, index) => {
            const isSelected = selectedCameraId === camera.id;
            const isProgram = programCameraId === camera.id;

            return (
              <div
                key={camera.id}
                className={cn(
                  'flex items-center gap-2 p-2 rounded cursor-pointer transition-colors',
                  isSelected
                    ? 'bg-zinc-800'
                    : 'hover:bg-zinc-800/50',
                  isProgram && 'ring-1 ring-red-500'
                )}
                onClick={() => selectCamera(camera.id)}
              >
                {/* Camera number */}
                <div
                  className="flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold"
                  style={{ backgroundColor: camera.color + '30', color: camera.color }}
                >
                  {index + 1}
                </div>

                {/* Camera icon */}
                <CameraIcon
                  className="h-3 w-3"
                  style={{ color: camera.color }}
                />

                {/* Camera name */}
                <span className="flex-1 text-xs truncate">{camera.name}</span>

                {/* Live indicator */}
                {isProgram && (
                  <Radio className="h-3 w-3 text-red-500 animate-pulse" />
                )}

                {/* Actions */}
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    onClick={(e) => {
                      e.stopPropagation();
                      setProgramCamera(camera.id);
                    }}
                    title="プログラム出力に設定"
                  >
                    <Radio className="h-2.5 w-2.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleEnabled(camera.id, camera.enabled);
                    }}
                    title={camera.enabled ? '無効にする' : '有効にする'}
                  >
                    {camera.enabled ? (
                      <Eye className="h-2.5 w-2.5" />
                    ) : (
                      <EyeOff className="h-2.5 w-2.5 text-zinc-500" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    onClick={(e) => {
                      e.stopPropagation();
                      duplicateCamera(camera.id);
                    }}
                    title="複製"
                  >
                    <Copy className="h-2.5 w-2.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 text-red-400 hover:text-red-300"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeCamera(camera.id);
                    }}
                    title="削除"
                  >
                    <Trash2 className="h-2.5 w-2.5" />
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Keyboard hint */}
      <div className="text-[10px] text-zinc-600 mt-2">
        数字キー 1-9 でカメラ切替、Space でプログラム出力
      </div>
    </div>
  );
}
