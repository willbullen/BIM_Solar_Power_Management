import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { migrate as migrateTelegram } from "./migrate-telegram";
import { migrate as migrateLangChain } from "./migrate-langchain";
import { setupUnifiedFunctionSystem, runMigration, migrateAgentFunctions } from "./migrate-function-system";
import { migrate as removeAgentFunctionsTable } from "./remove-agent-functions-table";
import { migrateLangchainNaming } from "./migrate-langchain-naming";
import cors from 'cors';

const app = express();

// Enable CORS for all routes with specific settings for Replit
app.use(cors({
  origin: true, // Allow any origin in development
  credentials: true, // Allow cookies to be sent
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Add headers for cross-origin requests
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,PATCH,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

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
  try {
    // Run Telegram database migration
    await migrateTelegram();
    console.log('Telegram database migration completed successfully');
    
    // Run LangChain database migration 
    try {
      await migrateLangChain();
      console.log('LangChain database migration completed successfully');
    } catch (langChainError) {
      console.error('Error during LangChain database migration:', langChainError);
      // Continue with server startup even if LangChain migration fails
    }
    
    // Run the agent function migration - completely move all functions to langchain_tools
    try {
      console.log('Starting complete migration of agent_functions to langchain_tools...');
      await migrateAgentFunctions();
      console.log('Complete migration of agent_functions to langchain_tools finished successfully');
      
      // After successful migration, remove the agent_functions table (force removal even if functions exist)
      try {
        console.log('Starting removal of agent_functions table...');
        // Use removeAgentFunctionsTable directly with force=true parameter
        await removeAgentFunctionsTable(true); 
        console.log('agent_functions table removed successfully');
      } catch (removalError) {
        console.error('Error during agent_functions table removal:', removalError);
        // Continue with server startup even if table removal fails
      }

      // Run the migration to rename agent tables to use langchain prefix
      try {
        console.log('Starting migration to rename agent tables to langchain prefix...');
        await migrateLangchainNaming(true);
        console.log('Table renaming migration completed successfully');
      } catch (renamingError) {
        console.error('Error during table renaming migration:', renamingError);
        // Continue with server startup even if renaming fails
      }
    } catch (migrationError) {
      console.error('Error during complete function migration:', migrationError);
      // Continue with server startup even if migration fails
    }
    
    // Set up the unified function system (which now only uses langchain_tools)
    try {
      await setupUnifiedFunctionSystem();
      console.log('Unified function system setup completed successfully');
    } catch (functionError) {
      console.error('Error setting up unified function system:', functionError);
      // Continue with server startup even if function system setup fails
    }
  } catch (error) {
    console.error('Error during Telegram database migration:', error);
    // Continue with server startup even if migration fails
  }
  
  const server = await registerRoutes(app);

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

  // Use port 5000 for Replit compatibility
  const port = 5000;
  
  // Log the environment for debugging
  console.log('Environment variables:');
  console.log(`PORT: ${port} (Using standard port for Replit compatibility)`);
  console.log(`NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
  console.log(`REPL_ID: ${process.env.REPL_ID || 'not set'}`);
  console.log(`REPL_OWNER: ${process.env.REPL_OWNER || 'not set'}`);
  console.log(`REPLIT_DB_URL: ${process.env.REPLIT_DB_URL ? 'set' : 'not set'}`);
  
  // Log open connections to debug connectivity issues
  server.on('connection', (socket) => {
    console.log('New connection established');
    socket.on('error', (error) => {
      console.log('Socket error:', error);
    });
  });
  
  // Try to start server on the primary port, fall back to alternate if primary is in use
  const startServer = (primaryPort: number, fallbackPort: number) => {
    server.listen({
      port: primaryPort,
      host: "0.0.0.0",
      reusePort: true,
    }, () => {
      log(`serving on port ${primaryPort}`);
    }).on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`Port ${primaryPort} is already in use, trying alternate port ${fallbackPort}`);
        
        // Attempt to use fallback port instead
        server.listen({
          port: fallbackPort,
          host: "0.0.0.0",
          reusePort: true,
        }, () => {
          log(`serving on alternate port ${fallbackPort}`);
        }).on('error', (fallbackErr: NodeJS.ErrnoException) => {
          console.error(`Failed to bind to alternate port ${fallbackPort}: ${fallbackErr.message}`);
        });
      } else {
        console.error(`Failed to start server: ${err.message}`);
      }
    });
  };
  
  // Start server with primary port 5000 and fallback port 5001
  startServer(5000, 5001);
})();
