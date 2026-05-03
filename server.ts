import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Global logger - very top
  app.use((req, res, next) => {
    console.log(`[SERVER] ${req.method} ${req.url}`);
    next();
  });

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // API ROUTE DEFINITIONS
  const apiRouter = express.Router();

  apiRouter.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString(), mode: process.env.NODE_ENV });
  });

  // Mount the router
  app.use('/api', apiRouter);

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    } else {
      console.warn("[SERVER] Warning: Production mode detected but 'dist' folder not found. Falling back to simple message.");
      app.get('*', (req, res) => {
        res.status(404).send("Application build not found. Please run 'npm run build' or use development mode.");
      });
    }
  }

  // Error handler for the Express app
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("[SERVER] Unhandled Error:", err);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: "An unexpected error occurred." });
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Advisor Server running on http://localhost:${PORT}`);
  });
}

startServer();
