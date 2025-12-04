'use client';

import React, { useCallback } from 'react';
import {
  Plus,
  Trash2,
  Copy,
  Play,
  Camera as CameraIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTimelineStore, useSelectedCut } from '@/lib/store/useTimelineStore';
import { useCameraStore } from '@/lib/store/useCameraStore';
import { secondsToTimecodeString } from '@/types/timeline';
import { cn } from '@/lib/utils';

export function CutList() {
  const cuts = useTimelineStore((state) => state.cuts);
  const selectedCutId = useTimelineStore((state) => state.selectedCutId);
  const frameRate = useTimelineStore((state) => state.frameRate);
  const { addCut, removeCut, updateCut, selectCut, duplicateCut, seekToCut } =
    useTimelineStore();

  const cameras = useCameraStore((state) => state.cameras);
  const selectedCameraId = useCameraStore((state) => state.selectedCameraId);
  const selectedCut = useSelectedCut();

  const handleAddCut = useCallback(() => {
    addCut({
      cameraId: selectedCameraId || '',
      duration: 5,
    });
  }, [addCut, selectedCameraId]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
          カットリスト
        </h3>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={handleAddCut}
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>

      {/* Cut list */}
      {cuts.length === 0 ? (
        <div className="text-xs text-zinc-500 text-center py-4">
          カットがありません
          <br />
          <button
            className="text-emerald-400 hover:underline mt-1"
            onClick={handleAddCut}
          >
            カットを追加
          </button>
        </div>
      ) : (
        <div className="space-y-1">
          {cuts.map((cut, index) => {
            const isSelected = selectedCutId === cut.id;
            const camera = cameras.find((c) => c.id === cut.cameraId);

            return (
              <div
                key={cut.id}
                className={cn(
                  'rounded cursor-pointer transition-colors',
                  isSelected ? 'bg-zinc-800' : 'hover:bg-zinc-800/50'
                )}
                onClick={() => selectCut(cut.id)}
              >
                <div className="flex items-center gap-2 p-2">
                  {/* Cut number */}
                  <div className="w-5 h-5 flex items-center justify-center rounded bg-zinc-700 text-[10px] font-bold">
                    {index + 1}
                  </div>

                  {/* Cut info */}
                  <div className="flex-1 min-w-0">
                    <div className="text-xs truncate">{cut.name}</div>
                    <div className="text-[10px] text-zinc-500 flex items-center gap-1">
                      <CameraIcon
                        className="h-2.5 w-2.5"
                        style={{ color: camera?.color }}
                      />
                      <span className="truncate">
                        {camera?.name || 'カメラ未設定'}
                      </span>
                      <span className="text-zinc-600">|</span>
                      <span className="font-mono">
                        {secondsToTimecodeString(cut.duration, frameRate)}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5"
                      onClick={(e) => {
                        e.stopPropagation();
                        seekToCut(cut.id);
                      }}
                      title="このカットへ移動"
                    >
                      <Play className="h-2.5 w-2.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5"
                      onClick={(e) => {
                        e.stopPropagation();
                        duplicateCut(cut.id);
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
                        removeCut(cut.id);
                      }}
                      title="削除"
                    >
                      <Trash2 className="h-2.5 w-2.5" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Selected cut properties */}
      {selectedCut && (
        <div className="space-y-3 pt-3 border-t border-zinc-800">
          <h4 className="text-xs font-medium text-zinc-400">カット設定</h4>

          {/* Name */}
          <div className="space-y-1">
            <Label className="text-[10px]">カット名</Label>
            <Input
              value={selectedCut.name}
              onChange={(e) => updateCut(selectedCut.id, { name: e.target.value })}
              className="h-6 text-xs"
            />
          </div>

          {/* Camera */}
          <div className="space-y-1">
            <Label className="text-[10px]">カメラ</Label>
            <Select
              value={selectedCut.cameraId}
              onValueChange={(value) =>
                updateCut(selectedCut.id, { cameraId: value })
              }
            >
              <SelectTrigger className="h-6 text-xs">
                <SelectValue placeholder="カメラを選択" />
              </SelectTrigger>
              <SelectContent>
                {cameras.map((camera) => (
                  <SelectItem key={camera.id} value={camera.id} className="text-xs">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: camera.color }}
                      />
                      {camera.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Duration */}
          <div className="space-y-1">
            <Label className="text-[10px]">デュレーション (秒)</Label>
            <Input
              type="number"
              value={selectedCut.duration}
              onChange={(e) =>
                updateCut(selectedCut.id, {
                  duration: parseFloat(e.target.value) || 1,
                })
              }
              className="h-6 text-xs"
              min={0.1}
              step={0.1}
            />
          </div>

          {/* Transition */}
          <div className="space-y-1">
            <Label className="text-[10px]">トランジション</Label>
            <Select
              value={selectedCut.transition}
              onValueChange={(value) =>
                updateCut(selectedCut.id, {
                  transition: value as 'cut' | 'dissolve' | 'fade' | 'wipe',
                })
              }
            >
              <SelectTrigger className="h-6 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cut" className="text-xs">
                  カット
                </SelectItem>
                <SelectItem value="dissolve" className="text-xs">
                  ディゾルブ
                </SelectItem>
                <SelectItem value="fade" className="text-xs">
                  フェード
                </SelectItem>
                <SelectItem value="wipe" className="text-xs">
                  ワイプ
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Transition duration */}
          {selectedCut.transition !== 'cut' && (
            <div className="space-y-1">
              <Label className="text-[10px]">トランジション時間 (秒)</Label>
              <Input
                type="number"
                value={selectedCut.transitionDuration}
                onChange={(e) =>
                  updateCut(selectedCut.id, {
                    transitionDuration: parseFloat(e.target.value) || 0.5,
                  })
                }
                className="h-6 text-xs"
                min={0}
                step={0.1}
              />
            </div>
          )}

          {/* Notes */}
          <div className="space-y-1">
            <Label className="text-[10px]">メモ</Label>
            <textarea
              value={selectedCut.notes || ''}
              onChange={(e) =>
                updateCut(selectedCut.id, { notes: e.target.value })
              }
              className="w-full h-16 bg-zinc-800 border border-zinc-700 rounded text-xs p-2 resize-none"
              placeholder="カットに関するメモ..."
            />
          </div>
        </div>
      )}
    </div>
  );
}
