import { Request, Response } from 'express';
import { mockRDSManager } from '../services/mockRDSServer';
import { ApiResponse } from '../types';
import { v4 as uuidv4 } from 'uuid';

export class MockRDSController {
  // Start mock RDS server
  static async startServer(req: Request, res: Response) {
    try {
      const { port } = req.body;

      if (!port) {
        const response: ApiResponse<any> = {
          success: false,
          error: 'Port is required',
        };
        return res.status(400).json(response);
      }

      if (port < 1024 || port > 65535) {
        const response: ApiResponse<any> = {
          success: false,
          error: 'Port must be between 1024 and 65535',
        };
        return res.status(400).json(response);
      }

      const server = await mockRDSManager.startServer(port);

      const response: ApiResponse<any> = {
        success: true,
        data: {
          port: server.getPort(),
          nodeCount: server.getNodeCount(),
          message: `Mock RDS server started on port ${port}`,
        },
      };
      res.json(response);
    } catch (error: any) {
      console.error('Error starting mock RDS server:', error);
      const response: ApiResponse<any> = {
        success: false,
        error: error.message,
      };
      res.status(500).json(response);
    }
  }

  // Stop mock RDS server
  static async stopServer(req: Request, res: Response) {
    try {
      const { port } = req.params;
      const portNum = parseInt(port, 10);

      await mockRDSManager.stopServer(portNum);

      const response: ApiResponse<any> = {
        success: true,
        data: {
          message: `Mock RDS server stopped on port ${portNum}`,
        },
      };
      res.json(response);
    } catch (error: any) {
      console.error('Error stopping mock RDS server:', error);
      const response: ApiResponse<any> = {
        success: false,
        error: error.message,
      };
      res.status(500).json(response);
    }
  }

  // Get all running mock RDS servers
  static async getAllServers(req: Request, res: Response) {
    try {
      const servers = mockRDSManager.getAllServers();
      const serverInfo = servers.map((server) => ({
        port: server.getPort(),
        nodeCount: server.getNodeCount(),
        running: server.isRunning(),
      }));

      const response: ApiResponse<any> = {
        success: true,
        data: serverInfo,
      };
      res.json(response);
    } catch (error: any) {
      console.error('Error getting mock RDS servers:', error);
      const response: ApiResponse<any> = {
        success: false,
        error: error.message,
      };
      res.status(500).json(response);
    }
  }

  // Get nodes from specific mock server
  static async getNodes(req: Request, res: Response) {
    try {
      const { port } = req.params;
      const portNum = parseInt(port, 10);

      const server = mockRDSManager.getServer(portNum);
      if (!server) {
        const response: ApiResponse<any> = {
          success: false,
          error: `No mock RDS server running on port ${portNum}`,
        };
        return res.status(404).json(response);
      }

      const nodes = server.getNodes();
      const response: ApiResponse<any> = {
        success: true,
        data: nodes,
      };
      res.json(response);
    } catch (error: any) {
      console.error('Error getting nodes:', error);
      const response: ApiResponse<any> = {
        success: false,
        error: error.message,
      };
      res.status(500).json(response);
    }
  }

  // Add node to mock server
  static async addNode(req: Request, res: Response) {
    try {
      const { port } = req.params;
      const portNum = parseInt(port, 10);
      const nodeData = req.body;

      const server = mockRDSManager.getServer(portNum);
      if (!server) {
        const response: ApiResponse<any> = {
          success: false,
          error: `No mock RDS server running on port ${portNum}`,
        };
        return res.status(404).json(response);
      }

      // Set defaults if not provided
      const node = {
        id: nodeData.id || uuidv4(),
        version: nodeData.version || `${Date.now()}:${Math.floor(Math.random() * 1000000000)}`,
        label: nodeData.label || 'Unnamed Node',
        description: nodeData.description || '',
        tags: nodeData.tags || {},
        type: nodeData.type || 'node',
        caps: nodeData.caps,
        subscription: nodeData.subscription,
      };

      server.addNode(node);

      const response: ApiResponse<any> = {
        success: true,
        data: node,
      };
      res.status(201).json(response);
    } catch (error: any) {
      console.error('Error adding node:', error);
      const response: ApiResponse<any> = {
        success: false,
        error: error.message,
      };
      res.status(500).json(response);
    }
  }

  // Remove node from mock server
  static async removeNode(req: Request, res: Response) {
    try {
      const { port, nodeId } = req.params;
      const portNum = parseInt(port, 10);

      const server = mockRDSManager.getServer(portNum);
      if (!server) {
        const response: ApiResponse<any> = {
          success: false,
          error: `No mock RDS server running on port ${portNum}`,
        };
        return res.status(404).json(response);
      }

      const removed = server.removeNode(nodeId);
      if (!removed) {
        const response: ApiResponse<any> = {
          success: false,
          error: 'Node not found',
        };
        return res.status(404).json(response);
      }

      const response: ApiResponse<any> = {
        success: true,
        data: {
          message: 'Node removed successfully',
        },
      };
      res.json(response);
    } catch (error: any) {
      console.error('Error removing node:', error);
      const response: ApiResponse<any> = {
        success: false,
        error: error.message,
      };
      res.status(500).json(response);
    }
  }

  // Clear all nodes from mock server
  static async clearNodes(req: Request, res: Response) {
    try {
      const { port } = req.params;
      const portNum = parseInt(port, 10);

      const server = mockRDSManager.getServer(portNum);
      if (!server) {
        const response: ApiResponse<any> = {
          success: false,
          error: `No mock RDS server running on port ${portNum}`,
        };
        return res.status(404).json(response);
      }

      server.clearNodes();

      const response: ApiResponse<any> = {
        success: true,
        data: {
          message: 'All nodes cleared successfully',
        },
      };
      res.json(response);
    } catch (error: any) {
      console.error('Error clearing nodes:', error);
      const response: ApiResponse<any> = {
        success: false,
        error: error.message,
      };
      res.status(500).json(response);
    }
  }
}
