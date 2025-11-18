import { Request, Response } from 'express';
import { RDSConnectionModel } from '../models/RDSConnection';
import { createNMOSService } from '../services/nmosService';
import { ApiResponse } from '../types';

export class RDSController {
  // Get all RDS connections
  static async getAll(req: Request, res: Response) {
    try {
      const connections = await RDSConnectionModel.getAll();
      const response: ApiResponse<any> = {
        success: true,
        data: connections,
      };
      res.json(response);
    } catch (error: any) {
      console.error('Error getting RDS connections:', error);
      const response: ApiResponse<any> = {
        success: false,
        error: error.message,
      };
      res.status(500).json(response);
    }
  }

  // Get RDS connection by ID
  static async getById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const connection = await RDSConnectionModel.getById(id);

      if (!connection) {
        const response: ApiResponse<any> = {
          success: false,
          error: 'RDS connection not found',
        };
        return res.status(404).json(response);
      }

      const response: ApiResponse<any> = {
        success: true,
        data: connection,
      };
      res.json(response);
    } catch (error: any) {
      console.error('Error getting RDS connection:', error);
      const response: ApiResponse<any> = {
        success: false,
        error: error.message,
      };
      res.status(500).json(response);
    }
  }

  // Create new RDS connection
  static async create(req: Request, res: Response) {
    try {
      const { name, ipAddress, port, timeout, enabled } = req.body;

      // Validation
      if (!name || !ipAddress || !port) {
        const response: ApiResponse<any> = {
          success: false,
          error: 'Missing required fields: name, ipAddress, port',
        };
        return res.status(400).json(response);
      }

      // Validate IP address format
      const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
      if (!ipRegex.test(ipAddress)) {
        const response: ApiResponse<any> = {
          success: false,
          error: 'Invalid IP address format',
        };
        return res.status(400).json(response);
      }

      // Validate port range
      if (port < 1 || port > 65535) {
        const response: ApiResponse<any> = {
          success: false,
          error: 'Port must be between 1 and 65535',
        };
        return res.status(400).json(response);
      }

      const connection = await RDSConnectionModel.create({
        name,
        ipAddress,
        port,
        timeout: timeout || 30,
        enabled: enabled !== undefined ? enabled : true,
      });

      const response: ApiResponse<any> = {
        success: true,
        data: connection,
      };
      res.status(201).json(response);
    } catch (error: any) {
      console.error('Error creating RDS connection:', error);
      const response: ApiResponse<any> = {
        success: false,
        error: error.message,
      };
      res.status(500).json(response);
    }
  }

  // Update RDS connection
  static async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { name, ipAddress, port, timeout, enabled } = req.body;

      // Validate IP address if provided
      if (ipAddress) {
        const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
        if (!ipRegex.test(ipAddress)) {
          const response: ApiResponse<any> = {
            success: false,
            error: 'Invalid IP address format',
          };
          return res.status(400).json(response);
        }
      }

      // Validate port if provided
      if (port !== undefined && (port < 1 || port > 65535)) {
        const response: ApiResponse<any> = {
          success: false,
          error: 'Port must be between 1 and 65535',
        };
        return res.status(400).json(response);
      }

      const connection = await RDSConnectionModel.update(id, {
        name,
        ipAddress,
        port,
        timeout,
        enabled,
      });

      if (!connection) {
        const response: ApiResponse<any> = {
          success: false,
          error: 'RDS connection not found',
        };
        return res.status(404).json(response);
      }

      const response: ApiResponse<any> = {
        success: true,
        data: connection,
      };
      res.json(response);
    } catch (error: any) {
      console.error('Error updating RDS connection:', error);
      const response: ApiResponse<any> = {
        success: false,
        error: error.message,
      };
      res.status(500).json(response);
    }
  }

  // Delete RDS connection
  static async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const deleted = await RDSConnectionModel.delete(id);

      if (!deleted) {
        const response: ApiResponse<any> = {
          success: false,
          error: 'RDS connection not found',
        };
        return res.status(404).json(response);
      }

      const response: ApiResponse<any> = {
        success: true,
        data: { message: 'RDS connection deleted successfully' },
      };
      res.json(response);
    } catch (error: any) {
      console.error('Error deleting RDS connection:', error);
      const response: ApiResponse<any> = {
        success: false,
        error: error.message,
      };
      res.status(500).json(response);
    }
  }

  // Test RDS connection
  static async testConnection(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const connection = await RDSConnectionModel.getById(id);

      if (!connection) {
        const response: ApiResponse<any> = {
          success: false,
          error: 'RDS connection not found',
        };
        return res.status(404).json(response);
      }

      const nmosService = createNMOSService(
        connection.ipAddress,
        connection.port,
        connection.timeout
      );

      const testResult = await nmosService.testConnection();

      if (testResult.success) {
        // Update last connected timestamp
        await RDSConnectionModel.updateLastConnected(id);
      }

      const response: ApiResponse<any> = {
        success: testResult.success,
        data: testResult,
      };
      res.json(response);
    } catch (error: any) {
      console.error('Error testing RDS connection:', error);
      const response: ApiResponse<any> = {
        success: false,
        error: error.message,
      };
      res.status(500).json(response);
    }
  }
}
