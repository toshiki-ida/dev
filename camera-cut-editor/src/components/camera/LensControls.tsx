'use client';

import React from 'react';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PRIME_FOCAL_LENGTHS, APERTURE_STOPS } from '@/lib/constants/lensPresets';

interface LensControlsProps {
  focalLength: number;
  aperture: number;
  focusDistance: number;
  onFocalLengthChange: (value: number) => void;
  onApertureChange: (value: number) => void;
  onFocusDistanceChange: (value: number) => void;
}

export function LensControls({
  focalLength,
  aperture,
  focusDistance,
  onFocalLengthChange,
  onApertureChange,
  onFocusDistanceChange,
}: LensControlsProps) {
  return (
    <div className="space-y-3">
      {/* Focal Length */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs">焦点距離</Label>
          <div className="flex items-center gap-1">
            <Input
              type="number"
              value={focalLength}
              onChange={(e) => onFocalLengthChange(parseFloat(e.target.value) || 35)}
              className="h-6 w-16 text-xs text-right"
              min={10}
              max={300}
            />
            <span className="text-xs text-zinc-500">mm</span>
          </div>
        </div>
        <Slider
          value={[focalLength]}
          min={10}
          max={200}
          step={1}
          onValueChange={([value]) => onFocalLengthChange(value)}
        />
        {/* Quick presets */}
        <div className="flex flex-wrap gap-1 mt-1">
          {[24, 35, 50, 85, 135].map((fl) => (
            <button
              key={fl}
              className={`px-1.5 py-0.5 text-[10px] rounded ${
                focalLength === fl
                  ? 'bg-emerald-600 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
              onClick={() => onFocalLengthChange(fl)}
            >
              {fl}mm
            </button>
          ))}
        </div>
      </div>

      {/* Aperture */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs">絞り (F値)</Label>
          <Select
            value={aperture.toString()}
            onValueChange={(val) => onApertureChange(parseFloat(val))}
          >
            <SelectTrigger className="h-6 w-20 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {APERTURE_STOPS.map((f) => (
                <SelectItem key={f} value={f.toString()} className="text-xs">
                  f/{f}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Slider
          value={[aperture]}
          min={1}
          max={22}
          step={0.1}
          onValueChange={([value]) => onApertureChange(value)}
        />
      </div>

      {/* Focus Distance */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs">フォーカス距離</Label>
          <div className="flex items-center gap-1">
            <Input
              type="number"
              value={focusDistance}
              onChange={(e) => onFocusDistanceChange(parseFloat(e.target.value) || 5)}
              className="h-6 w-16 text-xs text-right"
              min={0.1}
              max={100}
              step={0.1}
            />
            <span className="text-xs text-zinc-500">m</span>
          </div>
        </div>
        <Slider
          value={[focusDistance]}
          min={0.5}
          max={50}
          step={0.1}
          onValueChange={([value]) => onFocusDistanceChange(value)}
        />
      </div>
    </div>
  );
}
