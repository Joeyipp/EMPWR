import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { Server as SocketIOServer } from 'socket.io';
import session from 'express-session';
import { createStorage } from "./storage";
import { loadApiKeysFromEnvironment, updateApiKey } from './helper/algorithm-key-check';
import connectPg from 'connect-pg-simple';
import pg from 'pg';
import cors from 'cors';

const app = express();

// Enable CORS for all routes to allow API access from external applications
app.use(cors({
  origin: true, // Allow all origins
  credentials: true, // Allow cookies to be sent
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Increase JSON payload size limit to 50MB to handle large enriched graphs
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));

// Create PostgreSQL session store if DATABASE_URL is available and working
let sessionStore;
async function initializeSessionStore() {
  if (process.env.DATABASE_URL) {
    try {
      console.log('Testing PostgreSQL connection for session storage...');
      
      // Test database connection first
      const testPool = new pg.Pool({
        connectionString: process.env.DATABASE_URL,
      });
      
      const client = await testPool.connect();
      await client.query('SELECT 1'); // Simple test query
      client.release();
      await testPool.end();
      
      // If test passed, create the actual session store
      const PostgresSessionStore = connectPg(session);
      const pool = new pg.Pool({
        connectionString: process.env.DATABASE_URL,
      });
      sessionStore = new PostgresSessionStore({
        pool,
        createTableIfMissing: true
      });
      console.log('Using PostgreSQL for session storage');
      return sessionStore;
    } catch (error) {
      console.error('PostgreSQL session store connection failed, using in-memory sessions:', error);
      return undefined;
    }
  } else {
    console.log('No DATABASE_URL, using in-memory sessions');
    return undefined;
  }
}

// Session middleware will be set up asynchronously in the IIFE below

// Create and store database instance in app locals for easy access in routes
// This will be set asynchronously in the IIFE below

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Initialize session store first
  sessionStore = await initializeSessionStore();
  
  // Set up session middleware after testing database connection
  app.use(session({
    store: sessionStore, // Use PostgreSQL store if available, otherwise in-memory
    secret: process.env.SESSION_SECRET || 'knowledge-graph-platform-secret',
    resave: false,
    saveUninitialized: false,
    rolling: true, // Extend session expiration on each request
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      sameSite: 'lax', // Protects against CSRF while allowing normal navigation
      httpOnly: true, // Prevents JavaScript access to the cookie
      path: '/' // Ensures cookie is valid for all routes
    }
  }));
  
  // Initialize storage
  app.locals.storage = await createStorage();
  
  // Initialize API keys from environment variables
  loadApiKeysFromEnvironment();
  
  // Load API keys from database if available
  try {
    const openAIKeys = await app.locals.storage.getApiKeysByProvider('openai');
    if (openAIKeys.length > 0) {
      // Sort by newest first
      const sortedKeys = [...openAIKeys].sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      updateApiKey('openai', sortedKeys[0].key);
      console.log(`Loaded OpenAI API key from database (ID: ${sortedKeys[0].id}, created: ${new Date(sortedKeys[0].createdAt).toLocaleDateString()})`);
    }
    
    const mistralKeys = await app.locals.storage.getApiKeysByProvider('mistral');
    if (mistralKeys.length > 0) {
      // Sort by newest first
      const sortedKeys = [...mistralKeys].sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      updateApiKey('mistral', sortedKeys[0].key);
      console.log(`Loaded Mistral API key from database (ID: ${sortedKeys[0].id}, created: ${new Date(sortedKeys[0].createdAt).toLocaleDateString()})`);
    }
  } catch (error) {
    console.error('Error loading API keys from database:', error);
  }

  const server = await registerRoutes(app);
  
  // Initialize Socket.IO server
  const io = new SocketIOServer(server);
  
  // Store Socket.IO instance in app for use in routes
  (app as any).io = io;
  
  // Socket.IO connection setup
  io.on('connection', (socket) => {
    log(`Socket connected: ${socket.id}`);
    
    socket.on('disconnect', () => {
      log(`Socket disconnected: ${socket.id}`);
    });
  });

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
