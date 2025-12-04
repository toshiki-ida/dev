'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { getSocket, connectSocket, disconnectSocket } from '@/lib/socket/client';
import type { Socket } from 'socket.io-client';
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  CameraUpdate,
  ModelUpdate,
  OnlineUser,
} from '@/lib/socket/types';

interface UseSocketOptions {
  projectId?: string;
  userId?: string;
  userName?: string;
}

interface UseSocketReturn {
  isConnected: boolean;
  onlineUsers: OnlineUser[];
  // Camera operations
  updateCamera: (cameraId: string, update: Partial<CameraUpdate>) => void;
  setCameraLive: (cameraId: string, isLive: boolean) => void;
  // Model operations
  updateModel: (modelId: string, update: Partial<ModelUpdate>) => void;
  // Event handlers
  onCameraUpdated: (callback: (data: { cameraId: string; update: Partial<CameraUpdate>; userId: string }) => void) => () => void;
  onCameraLive: (callback: (data: { cameraId: string; isLive: boolean }) => void) => () => void;
  onModelUpdated: (callback: (data: { modelId: string; update: Partial<ModelUpdate> }) => void) => () => void;
  onUserJoined: (callback: (data: { userId: string; userName: string; projectId: string }) => void) => () => void;
  onUserLeft: (callback: (data: { userId: string; projectId: string }) => void) => () => void;
}

export function useSocket(options: UseSocketOptions = {}): UseSocketReturn {
  const { projectId, userId, userName } = options;
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const socketRef = useRef<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);

  useEffect(() => {
    socketRef.current = getSocket();
    const socket = socketRef.current;

    const handleConnect = () => {
      setIsConnected(true);
      console.log('[Socket] Connected');

      // Join project room if details provided
      if (projectId && userId && userName) {
        socket.emit('project:join', { projectId, userId, userName });
      }
    };

    const handleDisconnect = () => {
      setIsConnected(false);
      console.log('[Socket] Disconnected');
    };

    const handleOnlineUsers = (data: { users: OnlineUser[] }) => {
      setOnlineUsers(data.users);
    };

    const handleUserJoined = (data: { userId: string; userName: string }) => {
      setOnlineUsers((prev) => {
        if (prev.some((u) => u.id === data.userId)) return prev;
        return [...prev, { id: data.userId, name: data.userName, socketId: '' }];
      });
    };

    const handleUserLeft = (data: { userId: string }) => {
      setOnlineUsers((prev) => prev.filter((u) => u.id !== data.userId));
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('users:online', handleOnlineUsers);
    socket.on('user:joined', handleUserJoined);
    socket.on('user:left', handleUserLeft);

    connectSocket();

    return () => {
      if (projectId && userId) {
        socket.emit('project:leave', { projectId, userId });
      }
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('users:online', handleOnlineUsers);
      socket.off('user:joined', handleUserJoined);
      socket.off('user:left', handleUserLeft);
      disconnectSocket();
    };
  }, [projectId, userId, userName]);

  // Camera operations
  const updateCamera = useCallback((cameraId: string, update: Partial<CameraUpdate>) => {
    socketRef.current?.emit('camera:update', { cameraId, update });
  }, []);

  const setCameraLive = useCallback((cameraId: string, isLive: boolean) => {
    socketRef.current?.emit('camera:setLive', { cameraId, isLive });
  }, []);

  // Model operations
  const updateModel = useCallback((modelId: string, update: Partial<ModelUpdate>) => {
    socketRef.current?.emit('model:update', { modelId, update });
  }, []);

  // Event subscription helpers
  const onCameraUpdated = useCallback(
    (callback: (data: { cameraId: string; update: Partial<CameraUpdate>; userId: string }) => void) => {
      socketRef.current?.on('camera:updated', callback);
      return () => socketRef.current?.off('camera:updated', callback);
    },
    []
  );

  const onCameraLive = useCallback(
    (callback: (data: { cameraId: string; isLive: boolean }) => void) => {
      socketRef.current?.on('camera:live', callback);
      return () => socketRef.current?.off('camera:live', callback);
    },
    []
  );

  const onModelUpdated = useCallback(
    (callback: (data: { modelId: string; update: Partial<ModelUpdate> }) => void) => {
      socketRef.current?.on('model:updated', callback);
      return () => socketRef.current?.off('model:updated', callback);
    },
    []
  );

  const onUserJoined = useCallback(
    (callback: (data: { userId: string; userName: string; projectId: string }) => void) => {
      socketRef.current?.on('user:joined', callback);
      return () => socketRef.current?.off('user:joined', callback);
    },
    []
  );

  const onUserLeft = useCallback(
    (callback: (data: { userId: string; projectId: string }) => void) => {
      socketRef.current?.on('user:left', callback);
      return () => socketRef.current?.off('user:left', callback);
    },
    []
  );

  return {
    isConnected,
    onlineUsers,
    updateCamera,
    setCameraLive,
    updateModel,
    onCameraUpdated,
    onCameraLive,
    onModelUpdated,
    onUserJoined,
    onUserLeft,
  };
}
