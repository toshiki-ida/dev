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

// データベース用 (snake_case)
export interface RDSConnectionDB {
  id: string;
  name: string;
  ip_address: string;
  port: number;
  timeout: number;
  enabled: number; // SQLite boolean
  last_connected?: string;
  created_at?: string;
  updated_at?: string;
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

// データベース用
export interface ScheduleDB {
  id: string;
  name: string;
  enabled: number;
  task_type: string;
  source_rds: string;
  target_rds?: string;
  node_filter: string;
  schedule_config: string;
  options: string;
  last_run?: string;
  next_run?: string;
  status: string;
  created_at?: string;
  updated_at?: string;
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

export interface LogDB {
  id: string;
  type: string;
  level: string;
  message: string;
  details?: string;
  created_at: string;
}

// API レスポンス
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
