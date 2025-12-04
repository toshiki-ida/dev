'use client';

import React, { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ArrowLeft, Plus, Trash2, Save, Grid, Eye, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCameraStore } from '@/lib/store/useCameraStore';
import { CameraSwitcher } from '@/components/switcher/CameraSwitcher';
import { cn } from '@/lib/utils';

// Dynamic imports for 3D viewers
const PreviewViewport = dynamic(
  () => import('@/components/viewer/PreviewViewport').then((mod) => mod.PreviewViewport),
  { ssr: false }
);

const ProgramOutput = dynamic(
  () => import('@/components/viewer/ProgramOutput').then((mod) => mod.ProgramOutput),
  { ssr: false }
);

const Viewport = dynamic(
  () => import('@/components/viewer/Viewport').then((mod) => mod.Viewport),
  { ssr: false }
);

interface LayoutCell {
  id: string;
  cameraId: string | null;
  row: number;
  col: number;
  rowSpan: number;
  colSpan: number;
  type: 'camera' | 'preview' | 'program';
}

interface LayoutConfig {
  id: string;
  name: string;
  rows: number;
  cols: number;
  cells: LayoutCell[];
}

const DEFAULT_LAYOUTS: LayoutConfig[] = [
  {
    id: 'quad',
    name: '4-Split',
    rows: 2,
    cols: 2,
    cells: [
      { id: '1', cameraId: null, row: 0, col: 0, rowSpan: 1, colSpan: 1, type: 'camera' },
      { id: '2', cameraId: null, row: 0, col: 1, rowSpan: 1, colSpan: 1, type: 'camera' },
      { id: '3', cameraId: null, row: 1, col: 0, rowSpan: 1, colSpan: 1, type: 'camera' },
      { id: '4', cameraId: null, row: 1, col: 1, rowSpan: 1, colSpan: 1, type: 'camera' },
    ],
  },
  {
    id: 'broadcast',
    name: 'Broadcast',
    rows: 2,
    cols: 3,
    cells: [
      { id: 'pgm', cameraId: null, row: 0, col: 0, rowSpan: 2, colSpan: 2, type: 'program' },
      { id: 'prev', cameraId: null, row: 0, col: 2, rowSpan: 1, colSpan: 1, type: 'preview' },
      { id: 'cam1', cameraId: null, row: 1, col: 2, rowSpan: 1, colSpan: 1, type: 'camera' },
    ],
  },
  {
    id: 'director',
    name: 'Director View',
    rows: 3,
    cols: 4,
    cells: [
      { id: 'pgm', cameraId: null, row: 0, col: 0, rowSpan: 2, colSpan: 2, type: 'program' },
      { id: 'prev', cameraId: null, row: 0, col: 2, rowSpan: 2, colSpan: 2, type: 'preview' },
      { id: 'cam1', cameraId: null, row: 2, col: 0, rowSpan: 1, colSpan: 1, type: 'camera' },
      { id: 'cam2', cameraId: null, row: 2, col: 1, rowSpan: 1, colSpan: 1, type: 'camera' },
      { id: 'cam3', cameraId: null, row: 2, col: 2, rowSpan: 1, colSpan: 1, type: 'camera' },
      { id: 'cam4', cameraId: null, row: 2, col: 3, rowSpan: 1, colSpan: 1, type: 'camera' },
    ],
  },
];

export default function LayoutEditorPage() {
  const cameras = useCameraStore((state) => state.cameras);
  const setProgramCamera = useCameraStore((state) => state.setProgramCamera);

  const [layouts, setLayouts] = useState<LayoutConfig[]>(DEFAULT_LAYOUTS);
  const [activeLayoutId, setActiveLayoutId] = useState<string>('broadcast');
  const [editMode, setEditMode] = useState(false);
  const [selectedCellId, setSelectedCellId] = useState<string | null>(null);

  const activeLayout = layouts.find((l) => l.id === activeLayoutId) || layouts[0];

  const updateCellCamera = useCallback((cellId: string, cameraId: string | null) => {
    setLayouts((prev) =>
      prev.map((layout) => {
        if (layout.id !== activeLayoutId) return layout;
        return {
          ...layout,
          cells: layout.cells.map((cell) =>
            cell.id === cellId ? { ...cell, cameraId } : cell
          ),
        };
      })
    );
  }, [activeLayoutId]);

  const addLayout = useCallback(() => {
    const newLayout: LayoutConfig = {
      id: crypto.randomUUID(),
      name: `Layout ${layouts.length + 1}`,
      rows: 2,
      cols: 2,
      cells: [
        { id: crypto.randomUUID(), cameraId: null, row: 0, col: 0, rowSpan: 1, colSpan: 1, type: 'camera' },
        { id: crypto.randomUUID(), cameraId: null, row: 0, col: 1, rowSpan: 1, colSpan: 1, type: 'camera' },
        { id: crypto.randomUUID(), cameraId: null, row: 1, col: 0, rowSpan: 1, colSpan: 1, type: 'camera' },
        { id: crypto.randomUUID(), cameraId: null, row: 1, col: 1, rowSpan: 1, colSpan: 1, type: 'camera' },
      ],
    };
    setLayouts((prev) => [...prev, newLayout]);
    setActiveLayoutId(newLayout.id);
  }, [layouts.length]);

  const renderCell = (cell: LayoutCell) => {
    const isSelected = selectedCellId === cell.id && editMode;
    const camera = cell.cameraId ? cameras.find((c) => c.id === cell.cameraId) : null;

    // Get camera index for display
    const cameraIndex = camera ? cameras.findIndex((c) => c.id === camera.id) : -1;

    return (
      <div
        key={cell.id}
        className={cn(
          'relative bg-zinc-900 rounded overflow-hidden',
          isSelected && 'ring-2 ring-blue-500',
          editMode && 'cursor-pointer hover:ring-2 hover:ring-blue-300'
        )}
        style={{
          gridRow: `${cell.row + 1} / span ${cell.rowSpan}`,
          gridColumn: `${cell.col + 1} / span ${cell.colSpan}`,
        }}
        onClick={() => editMode && setSelectedCellId(cell.id)}
      >
        {cell.type === 'program' ? (
          <ProgramOutput className="w-full h-full" />
        ) : cell.type === 'preview' ? (
          <PreviewViewport className="w-full h-full" />
        ) : camera ? (
          <Viewport
            viewportId={cell.id}
            camera={camera}
            isActive={isSelected}
            onActivate={() => {
              if (!editMode) {
                setProgramCamera(camera.id);
              }
            }}
            onDoubleClick={() => {}}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-zinc-500">
            {editMode ? (
              <span className="text-sm">Click to assign camera</span>
            ) : (
              <span className="text-sm">No camera</span>
            )}
          </div>
        )}

        {/* Cell label */}
        {!editMode && cell.type === 'camera' && camera && (
          <div className="absolute top-2 left-2 px-2 py-1 bg-black/50 text-white text-xs rounded">
            CAM {cameraIndex + 1}: {camera.name}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-zinc-950 text-white overflow-hidden">
      {/* Header */}
      <header className="h-14 border-b border-zinc-800 flex items-center px-4 gap-4">
        <Link href="/">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Editor
          </Button>
        </Link>

        <div className="h-6 w-px bg-zinc-700" />

        <h1 className="text-lg font-semibold">Layout Editor</h1>

        <div className="flex-1" />

        {/* Layout selector */}
        <div className="flex gap-2">
          {layouts.map((layout) => (
            <Button
              key={layout.id}
              variant={activeLayoutId === layout.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveLayoutId(layout.id)}
            >
              {layout.name}
            </Button>
          ))}
          <Button variant="outline" size="sm" onClick={addLayout}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <div className="h-6 w-px bg-zinc-700" />

        <Button
          variant={editMode ? 'default' : 'outline'}
          size="sm"
          onClick={() => setEditMode(!editMode)}
          className="gap-2"
        >
          <Settings className="h-4 w-4" />
          {editMode ? 'Done' : 'Edit'}
        </Button>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Layout preview area */}
        <div className="flex-1 p-4">
          <div
            className="w-full h-full gap-2"
            style={{
              display: 'grid',
              gridTemplateRows: `repeat(${activeLayout.rows}, 1fr)`,
              gridTemplateColumns: `repeat(${activeLayout.cols}, 1fr)`,
            }}
          >
            {activeLayout.cells.map((cell) => renderCell(cell))}
          </div>
        </div>

        {/* Right sidebar - Edit panel */}
        {editMode && (
          <div className="w-80 border-l border-zinc-800 p-4 overflow-y-auto">
            <h2 className="text-sm font-semibold mb-4">Cell Settings</h2>

            {selectedCellId ? (
              <div className="space-y-4">
                {/* Cell type */}
                <div>
                  <Label>Cell Type</Label>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {(['camera', 'preview', 'program'] as const).map((type) => {
                      const cell = activeLayout.cells.find((c) => c.id === selectedCellId);
                      return (
                        <Button
                          key={type}
                          variant={cell?.type === type ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => {
                            setLayouts((prev) =>
                              prev.map((layout) => {
                                if (layout.id !== activeLayoutId) return layout;
                                return {
                                  ...layout,
                                  cells: layout.cells.map((c) =>
                                    c.id === selectedCellId ? { ...c, type } : c
                                  ),
                                };
                              })
                            );
                          }}
                        >
                          {type.charAt(0).toUpperCase() + type.slice(1)}
                        </Button>
                      );
                    })}
                  </div>
                </div>

                {/* Camera assignment */}
                {activeLayout.cells.find((c) => c.id === selectedCellId)?.type === 'camera' && (
                  <div>
                    <Label>Assign Camera</Label>
                    <div className="space-y-2 mt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full justify-start"
                        onClick={() => updateCellCamera(selectedCellId, null)}
                      >
                        None
                      </Button>
                      {cameras.map((camera, index) => {
                        const cell = activeLayout.cells.find((c) => c.id === selectedCellId);
                        return (
                          <Button
                            key={camera.id}
                            variant={cell?.cameraId === camera.id ? 'default' : 'outline'}
                            size="sm"
                            className="w-full justify-start gap-2"
                            onClick={() => updateCellCamera(selectedCellId, camera.id)}
                          >
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: camera.color }}
                            />
                            CAM {index + 1}: {camera.name}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-zinc-500">Select a cell to edit</p>
            )}

            <div className="mt-8 pt-4 border-t border-zinc-800">
              <h3 className="text-sm font-semibold mb-4">Layout Settings</h3>

              <div className="space-y-4">
                <div>
                  <Label>Layout Name</Label>
                  <Input
                    value={activeLayout.name}
                    onChange={(e) => {
                      setLayouts((prev) =>
                        prev.map((l) =>
                          l.id === activeLayoutId ? { ...l, name: e.target.value } : l
                        )
                      );
                    }}
                    className="mt-1"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Rows</Label>
                    <Input
                      type="number"
                      min={1}
                      max={4}
                      value={activeLayout.rows}
                      onChange={(e) => {
                        const rows = Math.max(1, Math.min(4, parseInt(e.target.value) || 1));
                        setLayouts((prev) =>
                          prev.map((l) => (l.id === activeLayoutId ? { ...l, rows } : l))
                        );
                      }}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Columns</Label>
                    <Input
                      type="number"
                      min={1}
                      max={4}
                      value={activeLayout.cols}
                      onChange={(e) => {
                        const cols = Math.max(1, Math.min(4, parseInt(e.target.value) || 1));
                        setLayouts((prev) =>
                          prev.map((l) => (l.id === activeLayoutId ? { ...l, cols } : l))
                        );
                      }}
                      className="mt-1"
                    />
                  </div>
                </div>

                <Button variant="outline" className="w-full gap-2">
                  <Save className="h-4 w-4" />
                  Save Layout
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom - Camera Switcher */}
      <div className="border-t border-zinc-800">
        <CameraSwitcher orientation="horizontal" className="w-full" />
      </div>
    </div>
  );
}
