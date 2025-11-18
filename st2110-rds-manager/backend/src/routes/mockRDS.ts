import { Router } from 'express';
import { MockRDSController } from '../controllers/mockRDSController';

const router = Router();

// Mock RDS server management
router.get('/', MockRDSController.getAllServers);
router.post('/start', MockRDSController.startServer);
router.post('/:port/stop', MockRDSController.stopServer);

// Node management for specific mock server
router.get('/:port/nodes', MockRDSController.getNodes);
router.post('/:port/nodes', MockRDSController.addNode);
router.delete('/:port/nodes/:nodeId', MockRDSController.removeNode);
router.delete('/:port/nodes', MockRDSController.clearNodes);

export default router;
