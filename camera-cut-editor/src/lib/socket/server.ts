import { Server as SocketIOServer } from 'socket.io';
import type { Server as HTTPServer } from 'http';
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
  OnlineUser,
  CameraData,
  ModelData,
} from './types';

// Store online users per project
const projectUsers = new Map<string, Map<string, OnlineUser>>();

// Store project camera and model data in memory (shared state)
interface ProjectState {
  cameras: Map<string, CameraData>;
  models: Map<string, ModelData>;
  programCameraId: string | null;
}
const projectStates = new Map<string, ProjectState>();

function getOrCreateProjectState(projectId: string): ProjectState {
  if (!projectStates.has(projectId)) {
    projectStates.set(projectId, {
      cameras: new Map(),
      models: new Map(),
      programCameraId: null,
    });
  }
  return projectStates.get(projectId)!;
}

export function initSocketServer(httpServer: HTTPServer) {
  const io = new SocketIOServer<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >(httpServer, {
    cors: {
      origin: process.env.NEXTAUTH_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    console.log('[Socket] Client connected:', socket.id);

    // Join a project room
    socket.on('project:join', ({ projectId, userId, userName }) => {
      socket.join(projectId);
      socket.data.userId = userId;
      socket.data.userName = userName;
      socket.data.projectId = projectId;

      // Add user to project users
      if (!projectUsers.has(projectId)) {
        projectUsers.set(projectId, new Map());
      }
      projectUsers.get(projectId)!.set(userId, {
        id: userId,
        name: userName,
        socketId: socket.id,
      });

      // Notify others in the room
      socket.to(projectId).emit('user:joined', { userId, userName, projectId });

      // Send current online users to the new user
      const users = Array.from(projectUsers.get(projectId)!.values());
      socket.emit('users:online', { users });

      // Send current project state (cameras and models) to the new user
      const projectState = getOrCreateProjectState(projectId);
      const cameras = Array.from(projectState.cameras.values());
      const models = Array.from(projectState.models.values());
      socket.emit('project:data', {
        cameras,
        models,
        programCameraId: projectState.programCameraId,
      });

      console.log(`[Socket] User ${userName} joined project ${projectId}, sending ${cameras.length} cameras, ${models.length} models`);
    });

    // Leave a project room
    socket.on('project:leave', ({ projectId, userId }) => {
      socket.leave(projectId);

      // Remove user from project users
      if (projectUsers.has(projectId)) {
        projectUsers.get(projectId)!.delete(userId);
        if (projectUsers.get(projectId)!.size === 0) {
          projectUsers.delete(projectId);
        }
      }

      // Notify others
      socket.to(projectId).emit('user:left', { userId, projectId });

      console.log(`[Socket] User ${userId} left project ${projectId}`);
    });

    // Camera create
    socket.on('camera:create', (cameraData) => {
      const { projectId } = socket.data;
      if (projectId) {
        const projectState = getOrCreateProjectState(projectId);
        projectState.cameras.set(cameraData.id, cameraData);
        // Broadcast to all other users
        socket.to(projectId).emit('camera:created', cameraData);
        console.log(`[Socket] Camera created: ${cameraData.name} in project ${projectId}`);
      }
    });

    // Camera update (real-time position/rotation changes)
    socket.on('camera:update', ({ cameraId, update }) => {
      const { projectId, userId } = socket.data;
      if (projectId) {
        // Update server state
        const projectState = getOrCreateProjectState(projectId);
        const camera = projectState.cameras.get(cameraId);
        if (camera) {
          Object.assign(camera, update);
        }
        // Broadcast to all other users in the project
        socket.to(projectId).emit('camera:updated', {
          cameraId,
          update,
          userId,
        });
      }
    });

    // Camera delete
    socket.on('camera:delete', ({ cameraId }) => {
      const { projectId } = socket.data;
      if (projectId) {
        const projectState = getOrCreateProjectState(projectId);
        projectState.cameras.delete(cameraId);
        if (projectState.programCameraId === cameraId) {
          projectState.programCameraId = null;
        }
        // Broadcast to all other users
        socket.to(projectId).emit('camera:deleted', { cameraId });
        console.log(`[Socket] Camera deleted: ${cameraId} in project ${projectId}`);
      }
    });

    // Set camera live (PGM output)
    socket.on('camera:setLive', ({ cameraId, isLive }) => {
      const { projectId } = socket.data;
      if (projectId) {
        // Update server state
        const projectState = getOrCreateProjectState(projectId);
        if (isLive) {
          projectState.programCameraId = cameraId;
        } else if (projectState.programCameraId === cameraId) {
          projectState.programCameraId = null;
        }
        // Broadcast to all users in the project (including sender for confirmation)
        io.to(projectId).emit('camera:live', { cameraId, isLive });
      }
    });

    // Model add
    socket.on('model:add', (modelData) => {
      const { projectId } = socket.data;
      if (projectId) {
        const projectState = getOrCreateProjectState(projectId);
        projectState.models.set(modelData.id, modelData);
        // Broadcast to all other users
        socket.to(projectId).emit('model:added', modelData);
        console.log(`[Socket] Model added: ${modelData.name} in project ${projectId}`);
      }
    });

    // Model update
    socket.on('model:update', ({ modelId, update }) => {
      const { projectId } = socket.data;
      if (projectId) {
        // Update server state
        const projectState = getOrCreateProjectState(projectId);
        const model = projectState.models.get(modelId);
        if (model) {
          Object.assign(model, update);
        }
        // Broadcast to all other users
        socket.to(projectId).emit('model:updated', { modelId, update });
      }
    });

    // Model delete
    socket.on('model:delete', ({ modelId }) => {
      const { projectId } = socket.data;
      if (projectId) {
        const projectState = getOrCreateProjectState(projectId);
        projectState.models.delete(modelId);
        // Broadcast to all other users
        socket.to(projectId).emit('model:deleted', { modelId });
        console.log(`[Socket] Model deleted: ${modelId} in project ${projectId}`);
      }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      const { projectId, userId } = socket.data;
      if (projectId && userId) {
        // Remove user from project users
        if (projectUsers.has(projectId)) {
          projectUsers.get(projectId)!.delete(userId);
          if (projectUsers.get(projectId)!.size === 0) {
            projectUsers.delete(projectId);
          }
        }

        // Notify others
        socket.to(projectId).emit('user:left', { userId, projectId });
      }
      console.log('[Socket] Client disconnected:', socket.id);
    });
  });

  return io;
}

export type SocketServer = ReturnType<typeof initSocketServer>;
