'use client';

import React, { useCallback, useRef, useState } from 'react';
import { Upload, FileBox, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useModelLoader } from '@/hooks/useModelLoader';
import { SUPPORTED_MODEL_EXTENSIONS, formatFileSize } from '@/lib/utils/fileUtils';
import { cn } from '@/lib/utils';

export function ModelImporter() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const { loadModels, isLoading, error } = useModelLoader();

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      console.log('[ModelImporter] handleFiles called:', {
        fileCount: fileArray.length,
        files: fileArray.map(f => ({ name: f.name, size: f.size, type: f.type }))
      });
      if (fileArray.length > 0) {
        try {
          const result = await loadModels(fileArray);
          console.log('[ModelImporter] loadModels result:', result);
        } catch (err) {
          console.error('[ModelImporter] loadModels error:', err);
        }
      }
    },
    [loadModels]
  );

  const handleClick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        handleFiles(e.target.files);
      }
    },
    [handleFiles]
  );

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('[ModelImporter] dragEnter');
    setIsDragOver(true);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('[ModelImporter] dragLeave');
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      console.log('[ModelImporter] drop event:', {
        files: e.dataTransfer?.files,
        items: e.dataTransfer?.items,
        types: e.dataTransfer?.types
      });

      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        handleFiles(files);
      } else {
        console.warn('[ModelImporter] No files in drop event');
      }
    },
    [handleFiles]
  );

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
        モデルインポート
      </h3>

      {/* Drop zone */}
      <div
        className={cn(
          'border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors',
          isDragOver
            ? 'border-emerald-400 bg-emerald-400/10'
            : 'border-zinc-700 hover:border-zinc-600',
          isLoading && 'pointer-events-none opacity-50'
        )}
        onClick={handleClick}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          ref={inputRef}
          type="file"
          accept={SUPPORTED_MODEL_EXTENSIONS.join(',')}
          multiple
          onChange={handleChange}
          className="hidden"
        />

        {isLoading ? (
          <div className="flex flex-col items-center gap-2">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-emerald-400 border-t-transparent" />
            <span className="text-xs text-zinc-400">読み込み中...</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload className="h-6 w-6 text-zinc-500" />
            <div className="text-xs">
              <span className="text-zinc-400">ドラッグ&ドロップ または </span>
              <span className="text-emerald-400">ファイル選択</span>
            </div>
          </div>
        )}
      </div>

      {/* Supported formats */}
      <div className="text-[10px] text-zinc-600 flex flex-wrap gap-1">
        {SUPPORTED_MODEL_EXTENSIONS.map((ext) => (
          <span
            key={ext}
            className="px-1.5 py-0.5 bg-zinc-800 rounded"
          >
            {ext}
          </span>
        ))}
      </div>

      {/* Error message */}
      {error && (
        <div className="flex items-center gap-2 text-xs text-red-400 bg-red-400/10 p-2 rounded">
          <AlertCircle className="h-3 w-3" />
          {error}
        </div>
      )}
    </div>
  );
}
