import { Router } from 'express';
import { NodesController } from '../controllers/nodesController';

const router = Router();

// Get all nodes from all RDS
router.get('/', NodesController.getAllNodes);

// Get nodes from specific RDS
router.get('/:rdsId', NodesController.getNodesFromRDS);

// Copy node between RDS
router.post('/copy', NodesController.copyNode);

// Delete node from RDS
router.delete('/:rdsId/:nodeId', NodesController.deleteNode);

export default router;
