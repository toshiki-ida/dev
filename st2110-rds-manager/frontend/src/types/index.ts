// RDS接続情報
export interface RDSConnection {
  id: string;
  name: string;
  ipAddress: string;
  port: number;
  timeout: number;
  enabled: boolean;
  lastConnected?: string;
  createdAt?: string;
  updatedAt?: string;
}

// ノード情報 (NMOS IS-04準拠)
export type NodeType = 'sender' | 'receiver' | 'flow' | 'source' | 'device' | 'node';

export interface Node {
  id: string;
  version: string;
  label: string;
  description: string;
  tags: Record<string, any>;
  type: NodeType;
  caps?: Record<string, any>;
  subscription?: Record<string, any>;
}

// Mock RDS Server
export interface MockServer {
  port: number;
  status: 'running' | 'stopped';
  nodeCount: number;
}

// スケジュール
export type TaskType = 'copy' | 'delete' | 'sync';
export type ScheduleType = 'once' | 'daily' | 'weekly' | 'monthly' | 'interval';
export type ScheduleStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface NodeFilter {
  resourceType?: string[];
  labels?: string[];
  tags?: Record<string, any>;
}

export interface ScheduleConfig {
  type: ScheduleType;
  datetime?: string;
  dayOfWeek?: number[];
  interval?: number;
}

export interface ScheduleOptions {
  overwrite: boolean;
  preserveId: boolean;
  followRelated: boolean;
}

export interface Schedule {
  id: string;
  name: string;
  enabled: boolean;
  taskType: TaskType;
  sourceRDS: string;
  targetRDS?: string;
  nodeFilter: NodeFilter;
  schedule: ScheduleConfig;
  options: ScheduleOptions;
  lastRun?: string;
  nextRun?: string;
  status: ScheduleStatus;
  createdAt?: string;
  updatedAt?: string;
}

// ログ
export type LogType = 'operation' | 'schedule' | 'error';
export type LogLevel = 'info' | 'warn' | 'error' | 'success';

export interface Log {
  id: string;
  type: LogType;
  level: LogLevel;
  message: string;
  details?: string;
  createdAt: string;
}

// API レスポンス
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ダッシュボード統計
export interface DashboardStats {
  connectedRDS: number;
  totalNodes: number;
  scheduledTasks: number;
  recentOperations: number;
}
