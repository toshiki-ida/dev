'use client';

import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Camera, Box, Film } from 'lucide-react';
import { ModelImporter } from '@/components/model/ModelImporter';
import { ModelTree } from '@/components/model/ModelTree';
import { CameraList } from '@/components/camera/CameraList';
import { CameraProperties } from '@/components/camera/CameraProperties';
import { CutList } from '@/components/timeline/CutList';

export function LeftPanel() {
  return (
    <div className="w-72 bg-zinc-900 border-r border-zinc-700 flex flex-col h-full">
      <Tabs defaultValue="models" className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-3 bg-zinc-800 rounded-none">
          <TabsTrigger value="models" className="text-xs gap-1">
            <Box className="h-3 w-3" />
            モデル
          </TabsTrigger>
          <TabsTrigger value="cameras" className="text-xs gap-1">
            <Camera className="h-3 w-3" />
            カメラ
          </TabsTrigger>
          <TabsTrigger value="cuts" className="text-xs gap-1">
            <Film className="h-3 w-3" />
            カット
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-auto">
          {/* Models Tab */}
          <TabsContent value="models" className="m-0 p-0">
            <div className="p-3 border-b border-zinc-700">
              <ModelImporter />
            </div>
            <div className="p-3">
              <ModelTree />
            </div>
          </TabsContent>

          {/* Cameras Tab */}
          <TabsContent value="cameras" className="m-0 p-0">
            <div className="p-3 border-b border-zinc-700">
              <CameraList />
            </div>
            <div className="p-3">
              <CameraProperties />
            </div>
          </TabsContent>

          {/* Cuts Tab */}
          <TabsContent value="cuts" className="m-0 p-0">
            <div className="p-3">
              <CutList />
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
