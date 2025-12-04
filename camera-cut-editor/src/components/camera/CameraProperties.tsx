'use client';

import React, { useCallback } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useCameraStore, useSelectedCamera } from '@/lib/store/useCameraStore';
import { SensorSelector } from './SensorSelector';
import { LensControls } from './LensControls';
import { roundTo, calculate35mmEquivalent } from '@/lib/utils/mathUtils';
import { getSensorPreset } from '@/lib/constants/sensorPresets';
import { SensorPreset } from '@/types/camera';

export function CameraProperties() {
  const selectedCamera = useSelectedCamera();
  const { updateCamera, setSensorPreset, setFocalLength, resetCamera } = useCameraStore();

  const handleNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (selectedCamera) {
        updateCamera(selectedCamera.id, { name: e.target.value });
      }
    },
    [selectedCamera, updateCamera]
  );

  const handlePositionChange = useCallback(
    (axis: 'x' | 'y' | 'z', value: string) => {
      if (selectedCamera) {
        const numValue = parseFloat(value) || 0;
        updateCamera(selectedCamera.id, {
          position: { ...selectedCamera.position, [axis]: numValue },
        });
      }
    },
    [selectedCamera, updateCamera]
  );

  const handlePanTiltRollChange = useCallback(
    (type: 'pan' | 'tilt' | 'roll', value: string) => {
      if (selectedCamera) {
        const numValue = parseFloat(value) || 0;
        updateCamera(selectedCamera.id, { [type]: numValue });
      }
    },
    [selectedCamera, updateCamera]
  );

  const handleSensorChange = useCallback(
    (presetId: string) => {
      if (selectedCamera) {
        setSensorPreset(selectedCamera.id, presetId);
      }
    },
    [selectedCamera, setSensorPreset]
  );

  const handleFocalLengthChange = useCallback(
    (value: number) => {
      if (selectedCamera) {
        setFocalLength(selectedCamera.id, value);
      }
    },
    [selectedCamera, setFocalLength]
  );

  const handleApertureChange = useCallback(
    (value: number) => {
      if (selectedCamera) {
        updateCamera(selectedCamera.id, { aperture: value });
      }
    },
    [selectedCamera, updateCamera]
  );

  const handleFocusDistanceChange = useCallback(
    (value: number) => {
      if (selectedCamera) {
        updateCamera(selectedCamera.id, { focusDistance: value });
      }
    },
    [selectedCamera, updateCamera]
  );

  const handleReset = useCallback(() => {
    if (selectedCamera) {
      resetCamera(selectedCamera.id);
    }
  }, [selectedCamera, resetCamera]);

  if (!selectedCamera) {
    return (
      <div className="text-xs text-zinc-500 text-center py-8">
        カメラを選択してください
      </div>
    );
  }

  const equivalent35mm = roundTo(
    calculate35mmEquivalent(
      selectedCamera.focalLength,
      selectedCamera.sensorWidth,
      selectedCamera.sensorHeight
    ),
    0
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
          プロパティ
        </h3>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={handleReset}
          title="リセット"
        >
          <RotateCcw className="h-3 w-3" />
        </Button>
      </div>

      {/* Name */}
      <div className="space-y-1.5">
        <Label className="text-xs">カメラ名</Label>
        <Input
          value={selectedCamera.name}
          onChange={handleNameChange}
          className="h-7 text-xs"
        />
      </div>

      <Separator />

      {/* Position */}
      <div className="space-y-1.5">
        <Label className="text-xs">位置</Label>
        <div className="grid grid-cols-3 gap-2">
          {(['x', 'y', 'z'] as const).map((axis) => (
            <div key={axis} className="flex items-center gap-1">
              <span className="text-[10px] text-zinc-500 uppercase w-3">
                {axis}
              </span>
              <Input
                type="number"
                value={roundTo(selectedCamera.position[axis], 2)}
                onChange={(e) => handlePositionChange(axis, e.target.value)}
                className="h-6 text-xs"
                step={0.1}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Pan/Tilt/Roll */}
      <div className="space-y-1.5">
        <Label className="text-xs">回転</Label>
        <div className="grid grid-cols-3 gap-2">
          {([
            { key: 'pan', label: 'Pan' },
            { key: 'tilt', label: 'Tilt' },
            { key: 'roll', label: 'Roll' },
          ] as const).map(({ key, label }) => (
            <div key={key} className="flex items-center gap-1">
              <span className="text-[10px] text-zinc-500 w-6 truncate">
                {label}
              </span>
              <Input
                type="number"
                value={roundTo(selectedCamera[key], 1)}
                onChange={(e) => handlePanTiltRollChange(key, e.target.value)}
                className="h-6 text-xs"
                step={1}
              />
            </div>
          ))}
        </div>
        <div className="text-[10px] text-zinc-500">
          単位: 度 (°)
        </div>
      </div>

      <Separator />

      {/* Sensor */}
      <div className="space-y-1.5">
        <Label className="text-xs">センサー</Label>
        <SensorSelector
          value={selectedCamera.sensorPreset}
          onChange={(id) => handleSensorChange(id)}
        />
        <div className="flex justify-between text-[10px] text-zinc-500">
          <span>
            {selectedCamera.sensorWidth} × {selectedCamera.sensorHeight} mm
          </span>
        </div>
      </div>

      <Separator />

      {/* Lens */}
      <LensControls
        focalLength={selectedCamera.focalLength}
        aperture={selectedCamera.aperture}
        focusDistance={selectedCamera.focusDistance}
        onFocalLengthChange={handleFocalLengthChange}
        onApertureChange={handleApertureChange}
        onFocusDistanceChange={handleFocusDistanceChange}
      />

      {/* Calculated values */}
      <div className="bg-zinc-800/50 rounded p-2 space-y-1">
        <div className="flex justify-between text-[10px]">
          <span className="text-zinc-500">垂直画角</span>
          <span className="font-mono">{roundTo(selectedCamera.fov, 1)}°</span>
        </div>
        <div className="flex justify-between text-[10px]">
          <span className="text-zinc-500">35mm換算</span>
          <span className="font-mono">{equivalent35mm}mm</span>
        </div>
      </div>
    </div>
  );
}
