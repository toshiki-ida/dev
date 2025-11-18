import api from './api';
import type { RDSConnection } from '../types';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export const rdsService = {
  // Get all RDS connections
  async getAll(): Promise<RDSConnection[]> {
    const response = await api.get<ApiResponse<RDSConnection[]>>('/rds');
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to fetch RDS connections');
    }
    return response.data.data || [];
  },

  // Get RDS connection by ID
  async getById(id: string): Promise<RDSConnection> {
    const response = await api.get<ApiResponse<RDSConnection>>(`/rds/${id}`);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to fetch RDS connection');
    }
    return response.data.data;
  },

  // Create new RDS connection
  async create(data: Omit<RDSConnection, 'id' | 'createdAt' | 'updatedAt'>): Promise<RDSConnection> {
    const response = await api.post<ApiResponse<RDSConnection>>('/rds', data);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to create RDS connection');
    }
    return response.data.data;
  },

  // Update RDS connection
  async update(id: string, data: Partial<RDSConnection>): Promise<RDSConnection> {
    const response = await api.put<ApiResponse<RDSConnection>>(`/rds/${id}`, data);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to update RDS connection');
    }
    return response.data.data;
  },

  // Delete RDS connection
  async delete(id: string): Promise<void> {
    const response = await api.delete<ApiResponse<any>>(`/rds/${id}`);
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to delete RDS connection');
    }
  },

  // Test RDS connection
  async testConnection(id: string): Promise<{ success: boolean; message: string; data?: any }> {
    const response = await api.post<ApiResponse<any>>(`/rds/${id}/test`);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to test connection');
    }
    return response.data.data;
  },
};
