import api from './api';
import type { Node } from '../types';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

interface RDSNodes {
  rdsId: string;
  rdsName: string;
  nodes: Node[];
  error?: string;
}

export const nodesService = {
  // Get all nodes from all RDS
  async getAllNodes(): Promise<RDSNodes[]> {
    const response = await api.get<ApiResponse<RDSNodes[]>>('/nodes');
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to fetch nodes');
    }
    return response.data.data || [];
  },

  // Get nodes from specific RDS
  async getNodesByRDS(rdsId: string): Promise<Node[]> {
    const response = await api.get<ApiResponse<Node[]>>(`/nodes/${rdsId}`);
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to fetch nodes');
    }
    return response.data.data || [];
  },

  // Copy node between RDS
  async copyNode(sourceRdsId: string, targetRdsId: string, nodeId: string): Promise<any> {
    const response = await api.post<ApiResponse<any>>('/nodes/copy', {
      sourceRdsId,
      targetRdsId,
      nodeId
    });
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to copy node');
    }
    return response.data.data;
  },

  // Delete node from RDS
  async deleteNode(rdsId: string, nodeId: string): Promise<void> {
    const response = await api.delete<ApiResponse<any>>(`/nodes/${rdsId}/${nodeId}`);
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to delete node');
    }
  },
};
