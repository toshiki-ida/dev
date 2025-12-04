import { Camera, ViewerLayout } from './camera';
import { ModelReference } from './model';
import { Cut, Marker } from './timeline';

export interface ProjectSettings {
  viewerLayout: ViewerLayout;
  frameRate: number;
  aspectRatio: string;
  safeFrames: boolean;
  gridVisible: boolean;
  cameraGizmosVisible: boolean;
  backgroundColor: string;
}

export interface Project {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;

  models: ModelReference[];
  cameras: Camera[];
  cutList: Cut[];
  markers: Marker[];

  settings: ProjectSettings;
}

export const DEFAULT_PROJECT_SETTINGS: ProjectSettings = {
  viewerLayout: 'quad',
  frameRate: 29.97,
  aspectRatio: '16:9',
  safeFrames: true,
  gridVisible: true,
  cameraGizmosVisible: true,
  backgroundColor: '#1a1a2e',
};

export function createNewProject(name: string = 'Untitled Project'): Project {
  return {
    id: crypto.randomUUID(),
    name,
    createdAt: new Date(),
    updatedAt: new Date(),
    models: [],
    cameras: [],
    cutList: [],
    markers: [],
    settings: { ...DEFAULT_PROJECT_SETTINGS },
  };
}
