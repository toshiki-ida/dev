import express, { Express, Request, Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Server } from 'http';

interface MockNode {
  id: string;
  version: string;
  label: string;
  description: string;
  tags: Record<string, any>;
  type: 'sender' | 'receiver' | 'flow' | 'source' | 'device' | 'node';
  caps?: Record<string, any>;
  subscription?: Record<string, any>;
}

export class MockRDSServer {
  private app: Express;
  private server: Server | null = null;
  private port: number;
  private nodes: Map<string, MockNode> = new Map();

  constructor(port: number = 8080) {
    this.port = port;
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    this.initializeDefaultNodes();
  }

  private setupMiddleware() {
    this.app.use(express.json());
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type');
      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
      } else {
        next();
      }
    });
  }

  private setupRoutes() {
    const router = Router();

    // NMOS IS-04 Registration API v1.3

    // Root endpoint
    router.get('/', (req: Request, res: Response) => {
      res.json(['resource/']);
    });

    // Health check
    router.get('/health', (req: Request, res: Response) => {
      res.json({ status: 'ok' });
    });

    // Get all resources
    router.get('/resource', (req: Request, res: Response) => {
      const resources = Array.from(this.nodes.values());
      res.json(resources);
    });

    // Get resources by type
    router.get('/resource/:resourceType', (req: Request, res: Response) => {
      const { resourceType } = req.params;
      const resources = Array.from(this.nodes.values()).filter(
        (node) => node.type === resourceType
      );
      res.json(resources);
    });

    // Get specific resource
    router.get('/resource/:resourceType/:resourceId', (req: Request, res: Response) => {
      const { resourceId } = req.params;
      const resource = this.nodes.get(resourceId);
      if (!resource) {
        return res.status(404).json({ error: 'Resource not found' });
      }
      res.json(resource);
    });

    // Register/Update resource
    router.post('/resource', (req: Request, res: Response) => {
      const resource = req.body;
      if (!resource.id) {
        resource.id = uuidv4();
      }
      if (!resource.version) {
        resource.version = `${Date.now()}:${Math.floor(Math.random() * 1000000000)}`;
      }
      this.nodes.set(resource.id, resource);
      res.status(201).json(resource);
    });

    // Delete resource
    router.delete('/resource/:resourceType/:resourceId', (req: Request, res: Response) => {
      const { resourceId } = req.params;
      if (!this.nodes.has(resourceId)) {
        return res.status(404).json({ error: 'Resource not found' });
      }
      this.nodes.delete(resourceId);
      res.status(204).send();
    });

    this.app.use('/x-nmos/registration/v1.3', router);
  }

  private initializeDefaultNodes() {
    // Add some default test nodes
    const defaultNodes: MockNode[] = [
      {
        id: uuidv4(),
        version: `${Date.now()}:0`,
        label: 'Test Camera 1',
        description: 'Mock camera sender',
        tags: { location: 'Studio A' },
        type: 'sender',
        caps: { media_types: ['video/raw'] },
      },
      {
        id: uuidv4(),
        version: `${Date.now()}:1`,
        label: 'Test Monitor 1',
        description: 'Mock monitor receiver',
        tags: { location: 'Studio A' },
        type: 'receiver',
        caps: { media_types: ['video/raw'] },
      },
      {
        id: uuidv4(),
        version: `${Date.now()}:2`,
        label: 'Test Audio Source',
        description: 'Mock audio source',
        tags: { location: 'Studio B' },
        type: 'source',
        caps: { media_types: ['audio/L24'] },
      },
    ];

    defaultNodes.forEach((node) => {
      this.nodes.set(node.id, node);
    });
  }

  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(this.port, () => {
          console.log(`Mock RDS server started on port ${this.port}`);
          resolve();
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.log(`Mock RDS server stopped on port ${this.port}`);
          this.server = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  isRunning(): boolean {
    return this.server !== null;
  }

  getPort(): number {
    return this.port;
  }

  // Test utility methods
  addNode(node: MockNode): void {
    if (!node.id) {
      node.id = uuidv4();
    }
    if (!node.version) {
      node.version = `${Date.now()}:${Math.floor(Math.random() * 1000000000)}`;
    }
    this.nodes.set(node.id, node);
  }

  removeNode(id: string): boolean {
    return this.nodes.delete(id);
  }

  clearNodes(): void {
    this.nodes.clear();
  }

  getNodes(): MockNode[] {
    return Array.from(this.nodes.values());
  }

  getNodeCount(): number {
    return this.nodes.size;
  }
}

// Singleton instance manager
class MockRDSManager {
  private servers: Map<number, MockRDSServer> = new Map();

  async startServer(port: number): Promise<MockRDSServer> {
    if (this.servers.has(port)) {
      throw new Error(`Mock RDS server already running on port ${port}`);
    }

    const server = new MockRDSServer(port);
    await server.start();
    this.servers.set(port, server);
    return server;
  }

  async stopServer(port: number): Promise<void> {
    const server = this.servers.get(port);
    if (server) {
      await server.stop();
      this.servers.delete(port);
    }
  }

  getServer(port: number): MockRDSServer | undefined {
    return this.servers.get(port);
  }

  getAllServers(): MockRDSServer[] {
    return Array.from(this.servers.values());
  }

  async stopAllServers(): Promise<void> {
    const promises = Array.from(this.servers.values()).map((server) => server.stop());
    await Promise.all(promises);
    this.servers.clear();
  }
}

export const mockRDSManager = new MockRDSManager();
