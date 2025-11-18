import axios, { AxiosInstance } from 'axios';

export class NMOSService {
  private client: AxiosInstance;

  constructor(ipAddress: string, port: number, timeout: number = 30000) {
    this.client = axios.create({
      baseURL: `http://${ipAddress}:${port}/x-nmos/registration/v1.3`,
      timeout: timeout * 1000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  // Test connection to RDS
  async testConnection(): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      const response = await this.client.get('/');
      return {
        success: true,
        message: 'Connection successful',
        data: response.data,
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Connection failed',
      };
    }
  }

  // Get all resources
  async getResources(): Promise<any[]> {
    try {
      const response = await this.client.get('/resource');
      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to get resources: ${error.message}`);
    }
  }

  // Get all nodes (all resources, not just type='nodes')
  async getAllNodes(): Promise<any[]> {
    try {
      const response = await this.client.get('/resource');
      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to get all nodes: ${error.message}`);
    }
  }

  // Get resources by type
  async getResourcesByType(resourceType: string): Promise<any[]> {
    try {
      const response = await this.client.get(`/resource/${resourceType}`);
      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to get ${resourceType} resources: ${error.message}`);
    }
  }

  // Get specific resource
  async getResource(resourceType: string, resourceId: string): Promise<any> {
    try {
      const response = await this.client.get(`/resource/${resourceType}/${resourceId}`);
      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to get resource: ${error.message}`);
    }
  }

  // Register resource
  async registerResource(resource: any): Promise<any> {
    try {
      const response = await this.client.post('/resource', resource);
      return response.data;
    } catch (error: any) {
      throw new Error(`Failed to register resource: ${error.message}`);
    }
  }

  // Delete resource
  async deleteResource(resourceType: string, resourceId: string): Promise<void> {
    try {
      await this.client.delete(`/resource/${resourceType}/${resourceId}`);
    } catch (error: any) {
      throw new Error(`Failed to delete resource: ${error.message}`);
    }
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      await this.client.get('/health', { timeout: 5000 });
      return true;
    } catch (error) {
      return false;
    }
  }
}

// Factory function to create NMOS service instance
export function createNMOSService(ipAddress: string, port: number, timeout?: number): NMOSService {
  return new NMOSService(ipAddress, port, timeout);
}

// Helper functions for node operations
export const nmosService = {
  // Get all nodes from an RDS (returns all resources)
  async getNodes(ipAddress: string, port: number, timeout?: number): Promise<any[]> {
    const service = new NMOSService(ipAddress, port, timeout);
    return await service.getAllNodes();
  },

  // Get a specific node by ID
  async getNodeById(ipAddress: string, port: number, nodeId: string, timeout?: number): Promise<any> {
    const service = new NMOSService(ipAddress, port, timeout);
    return await service.getResource('nodes', nodeId);
  },

  // Register a node to RDS
  async registerNode(ipAddress: string, port: number, node: any, timeout?: number): Promise<any> {
    const service = new NMOSService(ipAddress, port, timeout);
    return await service.registerResource(node);
  },

  // Delete a node from RDS
  async deleteNode(ipAddress: string, port: number, nodeId: string, timeout?: number): Promise<void> {
    const service = new NMOSService(ipAddress, port, timeout);
    return await service.deleteResource('nodes', nodeId);
  },

  // Test connection
  async testConnection(ipAddress: string, port: number, timeout?: number): Promise<{ success: boolean; message: string; data?: any }> {
    const service = new NMOSService(ipAddress, port, timeout);
    return await service.testConnection();
  }
};
