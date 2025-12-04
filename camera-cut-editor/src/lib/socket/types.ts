// Socket.io event types for real-time collaboration

export interface ServerToClientEvents {
  // Project events
  'project:updated': (data: { projectId: string; update: Partial<ProjectUpdate> }) => void;
  'project:data': (data: { cameras: CameraData[]; models: ModelData[]; programCameraId: string | null }) => void;

  // Camera events
  'camera:created': (data: CameraData) => void;
  'camera:updated': (data: { cameraId: string; update: Partial<CameraUpdate>; userId: string }) => void;
  'camera:deleted': (data: { cameraId: string }) => void;
  'camera:live': (data: { cameraId: string; isLive: boolean }) => void;

  // User presence
  'user:joined': (data: { userId: string; userName: string; projectId: string }) => void;
  'user:left': (data: { userId: string; projectId: string }) => void;
  'users:online': (data: { users: OnlineUser[] }) => void;

  // Model events
  'model:added': (data: ModelData) => void;
  'model:updated': (data: { modelId: string; update: Partial<ModelUpdate> }) => void;
  'model:deleted': (data: { modelId: string }) => void;
}

export interface ClientToServerEvents {
  // Room management
  'project:join': (data: { projectId: string; userId: string; userName: string }) => void;
  'project:leave': (data: { projectId: string; userId: string }) => void;

  // Camera CRUD (for real-time sync)
  'camera:create': (data: CameraData) => void;
  'camera:update': (data: { cameraId: string; update: Partial<CameraUpdate> }) => void;
  'camera:delete': (data: { cameraId: string }) => void;
  'camera:setLive': (data: { cameraId: string; isLive: boolean }) => void;

  // Model CRUD
  'model:add': (data: ModelData) => void;
  'model:update': (data: { modelId: string; update: Partial<ModelUpdate> }) => void;
  'model:delete': (data: { modelId: string }) => void;
}

export interface InterServerEvents {
  ping: () => void;
}

export interface SocketData {
  userId: string;
  userName: string;
  projectId: string;
}

// Data types
export interface ProjectUpdate {
  name: string;
  description: string;
}

export interface CameraData {
  id: string;
  name: string;
  order: number;
  positionX: number;
  positionY: number;
  positionZ: number;
  pan: number;
  tilt: number;
  roll: number;
  fov: number;
  focalLength: number;
  sensorPreset: string;
  sensorWidth: number;
  sensorHeight: number;
  color: string;
  enabled: boolean;
  isLive: boolean;
  projectId: string;
}

export interface CameraUpdate {
  name: string;
  order: number;
  positionX: number;
  positionY: number;
  positionZ: number;
  pan: number;
  tilt: number;
  roll: number;
  fov: number;
  focalLength: number;
  near: number;
  far: number;
  isLive: boolean;
}

export interface ModelData {
  id: string;
  name: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  url: string;  // Server URL to download the model
  positionX: number;
  positionY: number;
  positionZ: number;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
  scaleX: number;
  scaleY: number;
  scaleZ: number;
  visible: boolean;
  projectId: string;
}

export interface ModelUpdate {
  name: string;
  positionX: number;
  positionY: number;
  positionZ: number;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
  scaleX: number;
  scaleY: number;
  scaleZ: number;
  visible: boolean;
}

export interface OnlineUser {
  id: string;
  name: string;
  socketId: string;
}
