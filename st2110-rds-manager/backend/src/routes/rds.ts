import { Router } from 'express';
import { RDSController } from '../controllers/rdsController';

const router = Router();

// RDS CRUD routes
router.get('/', RDSController.getAll);
router.get('/:id', RDSController.getById);
router.post('/', RDSController.create);
router.put('/:id', RDSController.update);
router.delete('/:id', RDSController.delete);

// Test connection
router.post('/:id/test', RDSController.testConnection);

export default router;
