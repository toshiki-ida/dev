import { Request, Response } from 'express';
import { RDSConnectionModel } from '../models/RDSConnection';
import { nmosService } from '../services/nmosService';

export class NodesController {
  // Get all nodes from a specific RDS
  static async getNodesFromRDS(req: Request, res: Response) {
    try {
      const { rdsId } = req.params;

      const rds = await RDSConnectionModel.getById(rdsId);
      if (!rds) {
        return res.status(404).json({ success: false, error: 'RDS connection not found' });
      }

      if (!rds.enabled) {
        return res.status(400).json({ success: false, error: 'RDS connection is disabled' });
      }

      const nodes = await nmosService.getNodes(rds.ipAddress, rds.port, rds.timeout);

      res.json({
        success: true,
        data: nodes,
        rds: {
          id: rds.id,
          name: rds.name
        }
      });
    } catch (error: any) {
      console.error('Error fetching nodes:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to fetch nodes' });
    }
  }

  // Copy node from one RDS to another
  static async copyNode(req: Request, res: Response) {
    try {
      const { sourceRdsId, targetRdsId, nodeId } = req.body;

      if (!sourceRdsId || !targetRdsId || !nodeId) {
        return res.status(400).json({
          success: false,
          error: 'sourceRdsId, targetRdsId, and nodeId are required'
        });
      }

      // Get source and target RDS connections
      const sourceRds = await RDSConnectionModel.getById(sourceRdsId);
      const targetRds = await RDSConnectionModel.getById(targetRdsId);

      if (!sourceRds || !targetRds) {
        return res.status(404).json({ success: false, error: 'RDS connection not found' });
      }

      if (!sourceRds.enabled || !targetRds.enabled) {
        return res.status(400).json({ success: false, error: 'RDS connection is disabled' });
      }

      // Get the node from source RDS
      const node = await nmosService.getNodeById(
        sourceRds.ipAddress,
        sourceRds.port,
        nodeId,
        sourceRds.timeout
      );

      if (!node) {
        return res.status(404).json({ success: false, error: 'Node not found in source RDS' });
      }

      // Register the node to target RDS
      const result = await nmosService.registerNode(
        targetRds.ipAddress,
        targetRds.port,
        node,
        targetRds.timeout
      );

      res.json({
        success: true,
        message: 'Node copied successfully',
        data: result
      });
    } catch (error: any) {
      console.error('Error copying node:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to copy node' });
    }
  }

  // Delete node from RDS
  static async deleteNode(req: Request, res: Response) {
    try {
      const { rdsId, nodeId } = req.params;

      const rds = await RDSConnectionModel.getById(rdsId);
      if (!rds) {
        return res.status(404).json({ success: false, error: 'RDS connection not found' });
      }

      if (!rds.enabled) {
        return res.status(400).json({ success: false, error: 'RDS connection is disabled' });
      }

      await nmosService.deleteNode(rds.ipAddress, rds.port, nodeId, rds.timeout);

      res.json({
        success: true,
        message: 'Node deleted successfully'
      });
    } catch (error: any) {
      console.error('Error deleting node:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to delete node' });
    }
  }

  // Get all nodes from all enabled RDS connections
  static async getAllNodes(req: Request, res: Response) {
    try {
      const connections = await RDSConnectionModel.getAll();
      const enabledConnections = connections.filter(c => c.enabled);

      const nodesPromises = enabledConnections.map(async (rds) => {
        try {
          const nodes = await nmosService.getNodes(rds.ipAddress, rds.port, rds.timeout);
          return {
            rdsId: rds.id,
            rdsName: rds.name,
            nodes: nodes || []
          };
        } catch (error) {
          console.error(`Error fetching nodes from ${rds.name}:`, error);
          return {
            rdsId: rds.id,
            rdsName: rds.name,
            nodes: [],
            error: 'Failed to fetch nodes'
          };
        }
      });

      const results = await Promise.all(nodesPromises);

      res.json({
        success: true,
        data: results
      });
    } catch (error: any) {
      console.error('Error fetching all nodes:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to fetch nodes' });
    }
  }
}
