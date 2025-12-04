'use client';

import React, { useCallback } from 'react';
import {
  Save,
  Download,
  Upload,
  Settings,
  Camera,
  Play,
  Square,
  LayoutGrid,
  Monitor,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useProjectStore } from '@/lib/store/useProjectStore';
import { useViewerStore } from '@/lib/store/useViewerStore';
import { useTimelineStore } from '@/lib/store/useTimelineStore';
import { VIEWER_LAYOUTS } from '@/lib/constants';
import { downloadBlob } from '@/lib/utils/fileUtils';
import { ConnectionStatus } from '@/components/ui/ConnectionStatus';

export function Header() {
  const projectStore = useProjectStore();
  const viewerStore = useViewerStore();
  const timelineStore = useTimelineStore();

  const handleSave = useCallback(() => {
    try {
      const json = projectStore.saveProject();
      const blob = new Blob([json], { type: 'application/json' });
      const fileName = `${projectStore.project?.name || 'project'}.camcut.json`;
      downloadBlob(blob, fileName);
    } catch (error) {
      console.error('Failed to save project:', error);
    }
  }, [projectStore]);

  const handleLoad = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.camcut.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        try {
          const text = await file.text();
          projectStore.loadProject(text);
        } catch (error) {
          console.error('Failed to load project:', error);
        }
      }
    };
    input.click();
  }, [projectStore]);

  const handleNewProject = useCallback(() => {
    if (projectStore.isDirty) {
      if (!confirm('現在のプロジェクトは保存されていません。新規プロジェクトを作成しますか？')) {
        return;
      }
    }
    projectStore.newProject();
  }, [projectStore]);

  return (
    <header className="h-12 bg-zinc-900 border-b border-zinc-700 flex items-center justify-between px-4">
      {/* Left section: Logo and Project Name */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Camera className="h-5 w-5 text-emerald-400" />
          <span className="font-semibold text-sm">Camera Cut Editor</span>
        </div>
        <div className="h-4 w-px bg-zinc-700" />
        <span className="text-sm text-zinc-400">
          {projectStore.project?.name || 'Untitled Project'}
          {projectStore.isDirty && ' *'}
        </span>
        <div className="h-4 w-px bg-zinc-700" />
        <ConnectionStatus />
      </div>

      {/* Center section: Playback controls */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => timelineStore.seekToStart()}
          className="h-8"
        >
          <Square className="h-3 w-3" />
        </Button>
        <Button
          variant={timelineStore.isPlaying ? 'default' : 'ghost'}
          size="sm"
          onClick={() => timelineStore.togglePlayback()}
          className="h-8"
        >
          <Play className="h-4 w-4" />
        </Button>
      </div>

      {/* Right section: Actions */}
      <div className="flex items-center gap-2">
        {/* Layout selector */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8">
              <LayoutGrid className="h-4 w-4 mr-1" />
              <span className="text-xs">Layout</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {VIEWER_LAYOUTS.map((layout) => (
              <DropdownMenuItem
                key={layout.id}
                onClick={() => viewerStore.setLayout(layout.id as typeof viewerStore.layout)}
              >
                {layout.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Layout Editor link */}
        <Link href="/layout-editor">
          <Button variant="ghost" size="sm" className="h-8">
            <Monitor className="h-4 w-4 mr-1" />
            <span className="text-xs">PGM/PVW</span>
          </Button>
        </Link>

        <div className="h-4 w-px bg-zinc-700" />

        {/* File actions */}
        <Button variant="ghost" size="sm" onClick={handleNewProject} className="h-8">
          新規
        </Button>
        <Button variant="ghost" size="sm" onClick={handleLoad} className="h-8">
          <Upload className="h-4 w-4 mr-1" />
          開く
        </Button>
        <Button variant="ghost" size="sm" onClick={handleSave} className="h-8">
          <Save className="h-4 w-4 mr-1" />
          保存
        </Button>

        <div className="h-4 w-px bg-zinc-700" />

        {/* Export */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8">
              <Download className="h-4 w-4 mr-1" />
              書き出し
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>カメラデータ (JSON)</DropdownMenuItem>
            <DropdownMenuItem>カメラデータ (CSV)</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Unreal Engine用</DropdownMenuItem>
            <DropdownMenuItem>Unity用</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>EDL (Edit Decision List)</DropdownMenuItem>
            <DropdownMenuItem>スクリーンショット</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="h-4 w-px bg-zinc-700" />

        {/* Settings */}
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Settings className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
