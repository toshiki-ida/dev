import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import { initDatabase } from './database/init';
import rdsRoutes from './routes/rds';
import nodesRoutes from './routes/nodes';
import schedulesRoutes from './routes/schedules';
import logsRoutes from './routes/logs';
import mockRDSRoutes from './routes/mockRDS';

const app: Express = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests from any localhost port or no origin (like mobile apps)
    if (!origin || /^http:\/\/localhost:\d+$/.test(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/api/rds', rdsRoutes);
app.use('/api/nodes', nodesRoutes);
app.use('/api/schedules', schedulesRoutes);
app.use('/api/logs', logsRoutes);
app.use('/api/mock-rds', mockRDSRoutes);

// Health check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ success: false, error: 'Not found' });
});

// Error handler
app.use((err: Error, req: Request, res: Response, next: any) => {
  console.error('Error:', err);
  res.status(500).json({ success: false, error: err.message });
});

// Initialize database and start server
initDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });

export default app;
