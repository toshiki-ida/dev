'use client';

import React from 'react';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SENSOR_PRESETS, getManufacturers } from '@/lib/constants/sensorPresets';
import { SensorPreset } from '@/types/camera';

interface SensorSelectorProps {
  value: string;
  onChange: (presetId: string, preset: SensorPreset) => void;
}

export function SensorSelector({ value, onChange }: SensorSelectorProps) {
  const manufacturers = getManufacturers();

  const handleChange = (presetId: string) => {
    const preset = SENSOR_PRESETS.find((p) => p.id === presetId);
    if (preset) {
      onChange(presetId, preset);
    }
  };

  // Group presets by manufacturer
  const presetsByManufacturer: Record<string, SensorPreset[]> = {};
  SENSOR_PRESETS.forEach((preset) => {
    const manufacturer = preset.manufacturer || 'Other';
    if (!presetsByManufacturer[manufacturer]) {
      presetsByManufacturer[manufacturer] = [];
    }
    presetsByManufacturer[manufacturer].push(preset);
  });

  return (
    <Select value={value} onValueChange={handleChange}>
      <SelectTrigger className="h-7 text-xs">
        <SelectValue placeholder="センサー選択" />
      </SelectTrigger>
      <SelectContent>
        {manufacturers.map((manufacturer) => (
          <SelectGroup key={manufacturer}>
            <SelectLabel className="text-[10px] text-zinc-500">
              {manufacturer}
            </SelectLabel>
            {presetsByManufacturer[manufacturer]?.map((preset) => (
              <SelectItem key={preset.id} value={preset.id} className="text-xs">
                <div className="flex items-center justify-between gap-4">
                  <span>{preset.name}</span>
                  <span className="text-zinc-500 text-[10px]">
                    {preset.width} × {preset.height}mm
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}
