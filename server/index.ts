import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import pg from "pg";
import helmet from "helmet";
import cors from "cors";
import crypto from "crypto";
import rateLimit from "express-rate-limit";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();
app.set('trust proxy', true); // Trust all proxies for custom domain support

// Security: CORS configuration
const isDevelopment = process.env.NODE_ENV === 'development';

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (health checks, same-origin requests, server-to-server)
    if (!origin) {
      return callback(null, true);
    }
    
    // In development, allow all Replit domains and localhost
    if (isDevelopment && (origin?.includes('.replit.dev') || origin?.startsWith('http://localhost:') || origin?.startsWith('http://127.0.0.1:'))) {
      return callback(null, true);
    }
    
    // In production, only allow whitelisted origins
    const allowedOrigins = [
      'https://sync2inventory.org',
      ...(process.env.REPLIT_DOMAINS?.split(',').map(d => `https://${d}`) || [])
    ];
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      log(`CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Security: Use Helmet to set security headers (HSTS, CSP, X-Frame-Options, etc.)
// Configure differently for dev (Vite) vs production
if (isDevelopment) {
  // Development: Relaxed CSP for Vite hot reload
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Allow Vite inline scripts
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"], // Allow Google Fonts
        fontSrc: ["'self'", "https://fonts.gstatic.com"], // Allow Google Fonts
        imgSrc: ["'self'", "data:", "https:"], // Allow Google profile images
        connectSrc: ["'self'", "ws:", "wss:"], // Allow WebSocket for Vite HMR
        workerSrc: ["'self'", "blob:"], // Allow workers for Vite/React Query
      },
    },
  }));
} else {
  // Production: Strict security headers
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"], // Tailwind + Google Fonts
        fontSrc: ["'self'", "https://fonts.gstatic.com"], // Google Fonts
        imgSrc: ["'self'", "data:", "https:"], // Allow Google profile images
        connectSrc: ["'self'", "https://accounts.google.com", "https://sheets.googleapis.com"],
        frameSrc: ["'none'"], // Prevent clickjacking
      },
    },
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },
  }));
}

// Security: Rate limiting for API endpoints to prevent DoS attacks
// IMPORTANT: Must be applied BEFORE body parsers to prevent resource exhaustion from large payloads
// Generous limits for internal tool used by NYPL technicians
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  // Skip rate limiting in development to avoid interrupting workflow
  skip: () => isDevelopment,
});

// Apply rate limiting to API routes BEFORE body parsers (prevents DoS from large payloads)
app.use('/api', apiLimiter);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Environment-based session storage configuration

// CRITICAL SECURITY: Enforce SESSION_SECRET in production
if (!isDevelopment && !process.env.SESSION_SECRET) {
  throw new Error('FATAL: SESSION_SECRET environment variable is required in production for secure session management');
}

// Generate secure session secret
// Development: Use random secret if not set (each restart generates new secret, sessions won't persist)
// Production: Use environment variable (enforced by check above)
const sessionSecret = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

let sessionStore;
if (isDevelopment) {
  // Development: Use in-memory store (allows database to scale to zero)
  sessionStore = new session.MemoryStore();
  log('Using in-memory session store for development (database can scale to zero)');
} else {
  // Production: Use PostgreSQL store for persistence
  const PgSession = connectPgSimple(session);
  const pgPool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    idleTimeoutMillis: 30000, // Close idle connections after 30s
    max: 2 // Limit pool size
  });
  sessionStore = new PgSession({
    pool: pgPool,
    tableName: 'user_sessions',
    createTableIfMissing: true,
  });
  log('Using PostgreSQL session store for production');
}

app.use(session({
  store: sessionStore,
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  proxy: true, // Trust proxy for secure cookies through multiple proxy layers
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax', // Allow cookies during OAuth redirects
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
  }
}));

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
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    // Security: Don't expose stack traces in production
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    if (isDevelopment) {
      // In development, include error details for debugging
      res.status(status).json({ 
        message,
        stack: err.stack 
      });
      console.error('Error:', err);
    } else {
      // In production, send generic error message for 500 errors
      const safeMessage = status === 500 ? 'Internal Server Error' : message;
      res.status(status).json({ message: safeMessage });
      // Log error for server-side debugging (not exposed to client)
      console.error('Production error:', { status, message: err.message, stack: err.stack });
    }
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
