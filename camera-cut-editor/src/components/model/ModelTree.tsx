'use client';

import React, { useCallback } from 'react';
import {
  Box,
  Eye,
  EyeOff,
  Trash2,
  MoreVertical,
  Move,
  RotateCw,
  Maximize2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useModelStore, useSelectedModel } from '@/lib/store/useModelStore';
import { formatFileSize } from '@/lib/utils/fileUtils';
import { cn } from '@/lib/utils';

export function ModelTree() {
  const models = useModelStore((state) => state.models);
  const selectedModelId = useModelStore((state) => state.selectedModelId);
  const loadProgress = useModelStore((state) => state.loadProgress);
  const {
    selectModel,
    removeModel,
    toggleModelVisibility,
    setModelPosition,
    setModelRotation,
    setModelScale,
  } = useModelStore();

  const selectedModel = useSelectedModel();

  const handleRemove = useCallback(
    (id: string) => {
      removeModel(id);
    },
    [removeModel]
  );

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
        シーン
      </h3>

      {models.length === 0 ? (
        <div className="text-xs text-zinc-500 text-center py-4">
          モデルがありません
          <br />
          3Dファイルをドロップしてください
        </div>
      ) : (
        <div className="space-y-1">
          {models.map((model) => {
            const isSelected = selectedModelId === model.id;
            const progress = loadProgress[model.id];
            const isLoading = model.isLoading || progress?.status === 'loading';

            return (
              <div
                key={model.id}
                className={cn(
                  'rounded cursor-pointer transition-colors',
                  isSelected ? 'bg-zinc-800' : 'hover:bg-zinc-800/50'
                )}
                onClick={() => selectModel(model.id)}
              >
                <div className="flex items-center gap-2 p-2">
                  {/* Icon */}
                  <Box className="h-3 w-3 text-zinc-500 flex-shrink-0" />

                  {/* Name and info */}
                  <div className="flex-1 min-w-0">
                    <div className="text-xs truncate">{model.reference.name}</div>
                    <div className="text-[10px] text-zinc-500 flex gap-2">
                      <span className="uppercase">{model.reference.fileType}</span>
                      <span>{formatFileSize(model.reference.fileSize)}</span>
                    </div>
                  </div>

                  {/* Loading indicator */}
                  {isLoading && (
                    <div className="flex items-center gap-1">
                      <div className="animate-spin rounded-full h-3 w-3 border border-emerald-400 border-t-transparent" />
                      {progress && (
                        <span className="text-[10px] text-zinc-500">
                          {Math.round(progress.progress * 100)}%
                        </span>
                      )}
                    </div>
                  )}

                  {/* Error indicator */}
                  {model.error && (
                    <span className="text-[10px] text-red-400 truncate max-w-20">
                      エラー
                    </span>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleModelVisibility(model.id);
                      }}
                    >
                      {model.reference.visible ? (
                        <Eye className="h-2.5 w-2.5" />
                      ) : (
                        <EyeOff className="h-2.5 w-2.5 text-zinc-500" />
                      )}
                    </Button>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="h-2.5 w-2.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => handleRemove(model.id)}
                          className="text-red-400"
                        >
                          <Trash2 className="h-3 w-3 mr-2" />
                          削除
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Transform controls for selected model */}
      {selectedModel && !selectedModel.isLoading && (
        <div className="space-y-3 pt-3 border-t border-zinc-800">
          <h4 className="text-xs font-medium text-zinc-400">トランスフォーム</h4>

          {/* Position */}
          <div className="space-y-1">
            <Label className="text-[10px] flex items-center gap-1">
              <Move className="h-2.5 w-2.5" />
              位置
            </Label>
            <div className="grid grid-cols-3 gap-1">
              {(['x', 'y', 'z'] as const).map((axis) => (
                <div key={axis} className="flex items-center gap-0.5">
                  <span className="text-[9px] text-zinc-500 uppercase w-2">
                    {axis}
                  </span>
                  <Input
                    type="number"
                    value={selectedModel.reference.transform.position[axis]}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value) || 0;
                      setModelPosition(selectedModel.id, {
                        ...selectedModel.reference.transform.position,
                        [axis]: value,
                      });
                    }}
                    className="h-5 text-[10px] px-1"
                    step={0.1}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Rotation */}
          <div className="space-y-1">
            <Label className="text-[10px] flex items-center gap-1">
              <RotateCw className="h-2.5 w-2.5" />
              回転
            </Label>
            <div className="grid grid-cols-3 gap-1">
              {(['x', 'y', 'z'] as const).map((axis) => (
                <div key={axis} className="flex items-center gap-0.5">
                  <span className="text-[9px] text-zinc-500 uppercase w-2">
                    {axis}
                  </span>
                  <Input
                    type="number"
                    value={selectedModel.reference.transform.rotation[axis]}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value) || 0;
                      setModelRotation(selectedModel.id, {
                        ...selectedModel.reference.transform.rotation,
                        [axis]: value,
                      });
                    }}
                    className="h-5 text-[10px] px-1"
                    step={5}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Scale */}
          <div className="space-y-1">
            <Label className="text-[10px] flex items-center gap-1">
              <Maximize2 className="h-2.5 w-2.5" />
              スケール
            </Label>
            <div className="grid grid-cols-3 gap-1">
              {(['x', 'y', 'z'] as const).map((axis) => (
                <div key={axis} className="flex items-center gap-0.5">
                  <span className="text-[9px] text-zinc-500 uppercase w-2">
                    {axis}
                  </span>
                  <Input
                    type="number"
                    value={selectedModel.reference.transform.scale[axis]}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value) || 1;
                      setModelScale(selectedModel.id, {
                        ...selectedModel.reference.transform.scale,
                        [axis]: value,
                      });
                    }}
                    className="h-5 text-[10px] px-1"
                    step={0.1}
                    min={0.01}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
