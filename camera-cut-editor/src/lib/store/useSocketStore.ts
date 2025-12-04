'use client';

import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents, OnlineUser, CameraUpdate, CameraData, ModelData, ModelUpdate } from '@/lib/socket/types';

interface SocketState {
  socket: Socket<ServerToClientEvents, ClientToServerEvents> | null;
  isConnected: boolean;
  projectId: string | null;
  userId: string;
  userName: string;
  onlineUsers: OnlineUser[];

  // Actions
  connect: (projectId: string, userName?: string) => void;
  disconnect: () => void;

  // Camera sync
  emitCameraCreate: (camera: CameraData) => void;
  emitCameraUpdate: (cameraId: string, update: Partial<CameraUpdate>) => void;
  emitCameraDelete: (cameraId: string) => void;
  emitCameraLive: (cameraId: string, isLive: boolean) => void;

  // Model sync
  emitModelAdd: (model: ModelData) => void;
  emitModelUpdate: (modelId: string, update: Partial<ModelUpdate>) => void;
  emitModelDelete: (modelId: string) => void;

  // Internal
  setOnlineUsers: (users: OnlineUser[]) => void;
  addOnlineUser: (user: OnlineUser) => void;
  removeOnlineUser: (userId: string) => void;
}

// Generate a random user ID if not exists
const getOrCreateUserId = (): string => {
  if (typeof window === 'undefined') return '';
  let userId = localStorage.getItem('camera-cut-user-id');
  if (!userId) {
    userId = crypto.randomUUID();
    localStorage.setItem('camera-cut-user-id', userId);
  }
  return userId;
};

const getOrCreateUserName = (): string => {
  if (typeof window === 'undefined') return 'Guest';
  let userName = localStorage.getItem('camera-cut-user-name');
  if (!userName) {
    userName = `User-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    localStorage.setItem('camera-cut-user-name', userName);
  }
  return userName;
};

export const useSocketStore = create<SocketState>((set, get) => ({
  socket: null,
  isConnected: false,
  projectId: null,
  userId: '',
  userName: '',
  onlineUsers: [],

  connect: (projectId: string, userName?: string) => {
    const state = get();

    // If already connected to same project, do nothing
    if (state.socket?.connected && state.projectId === projectId) {
      return;
    }

    // Disconnect if connected to different project
    if (state.socket) {
      state.socket.disconnect();
    }

    const userId = getOrCreateUserId();
    const finalUserName = userName || getOrCreateUserName();

    // Save user name
    if (typeof window !== 'undefined') {
      localStorage.setItem('camera-cut-user-name', finalUserName);
    }

    const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3000', {
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      console.log('[Socket] Connected to server');
      set({ isConnected: true });

      // Join project room
      socket.emit('project:join', {
        projectId,
        userId,
        userName: finalUserName,
      });
    });

    socket.on('disconnect', () => {
      console.log('[Socket] Disconnected from server');
      set({ isConnected: false });
    });

    socket.on('users:online', ({ users }) => {
      set({ onlineUsers: users });
    });

    socket.on('user:joined', ({ userId, userName }) => {
      console.log(`[Socket] User joined: ${userName}`);
      get().addOnlineUser({ id: userId, name: userName, socketId: '' });
    });

    socket.on('user:left', ({ userId }) => {
      console.log(`[Socket] User left: ${userId}`);
      get().removeOnlineUser(userId);
    });

    set({
      socket,
      projectId,
      userId,
      userName: finalUserName,
    });
  },

  disconnect: () => {
    const state = get();
    if (state.socket) {
      if (state.projectId) {
        state.socket.emit('project:leave', {
          projectId: state.projectId,
          userId: state.userId,
        });
      }
      state.socket.disconnect();
    }
    set({
      socket: null,
      isConnected: false,
      projectId: null,
      onlineUsers: [],
    });
  },

  emitCameraCreate: (camera: CameraData) => {
    const { socket } = get();
    if (socket?.connected) {
      socket.emit('camera:create', camera);
    }
  },

  emitCameraUpdate: (cameraId: string, update: Partial<CameraUpdate>) => {
    const { socket } = get();
    if (socket?.connected) {
      socket.emit('camera:update', { cameraId, update });
    }
  },

  emitCameraDelete: (cameraId: string) => {
    const { socket } = get();
    if (socket?.connected) {
      socket.emit('camera:delete', { cameraId });
    }
  },

  emitCameraLive: (cameraId: string, isLive: boolean) => {
    const { socket } = get();
    if (socket?.connected) {
      socket.emit('camera:setLive', { cameraId, isLive });
    }
  },

  emitModelAdd: (model: ModelData) => {
    const { socket } = get();
    if (socket?.connected) {
      socket.emit('model:add', model);
    }
  },

  emitModelUpdate: (modelId: string, update: Partial<ModelUpdate>) => {
    const { socket } = get();
    if (socket?.connected) {
      socket.emit('model:update', { modelId, update });
    }
  },

  emitModelDelete: (modelId: string) => {
    const { socket } = get();
    if (socket?.connected) {
      socket.emit('model:delete', { modelId });
    }
  },

  setOnlineUsers: (users: OnlineUser[]) => set({ onlineUsers: users }),

  addOnlineUser: (user: OnlineUser) => set((state) => ({
    onlineUsers: [...state.onlineUsers.filter(u => u.id !== user.id), user]
  })),

  removeOnlineUser: (userId: string) => set((state) => ({
    onlineUsers: state.onlineUsers.filter(u => u.id !== userId)
  })),
}));
