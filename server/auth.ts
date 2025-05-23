import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import { compare, hash } from "bcrypt";
import { storage } from "./storage";
import { User as SelectUser, insertUserSchema } from "@shared/schema";
import { ZodError } from "zod";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

// Authentication middleware
export function authenticateUser(req: Request, res: Response, next: NextFunction) {
  // First try standard session-based authentication
  if (req.isAuthenticated()) {
    return next();
  }
  
  // If not authenticated via session, check for header-based auth
  const headerUserId = req.header('X-Auth-User-Id');
  const headerUsername = req.header('X-Auth-Username');
  
  if (headerUserId && headerUsername) {
    try {
      // Validate the header credentials
      const userId = parseInt(headerUserId, 10);
      if (isNaN(userId)) {
        return res.status(401).json({ message: 'Authentication required. Please login again.' });
      }
      
      // Add the user ID to the request object for use in route handlers
      req.user = { id: userId, username: headerUsername } as Express.User;
      return next();
    } catch (error) {
      console.error('Header auth validation error:', error);
    }
  }
  
  // If we get here, neither session nor header auth was successful
  return res.status(401).json({ message: 'Authentication required. Please login again.' });
}

export function setupAuth(app: Express) {
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "emporium-power-dashboard-secret",
    resave: true,
    saveUninitialized: true,
    store: storage.sessionStore,
    name: 'emporium.sid', // Custom name to avoid conflicts
    cookie: {
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      sameSite: 'lax', // Use 'lax' for better compatibility
      secure: false, // Set to false since Replit can use both http and https
      httpOnly: true,
      path: '/' // Ensure cookie is available across the entire site
    }
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user) {
          return done(null, false, { message: "Invalid username or password" });
        }
        
        const isPasswordValid = await compare(password, user.password);
        if (!isPasswordValid) {
          return done(null, false, { message: "Invalid username or password" });
        }
        
        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (error) {
      done(error);
    }
  });

  // User registration endpoint
  app.post("/api/register", async (req, res, next) => {
    try {
      // Validate input
      const validatedData = insertUserSchema.parse(req.body);
      
      // Check if username already exists
      const existingUser = await storage.getUserByUsername(validatedData.username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }
      
      // Hash password
      const hashedPassword = await hash(validatedData.password, 10);
      
      // Create user with hashed password
      const user = await storage.createUser({
        ...validatedData,
        password: hashedPassword
      });
      
      // Log the user in
      req.login(user, (err) => {
        if (err) return next(err);
        
        // Store user ID and role in session for authentication
        req.session.userId = user.id;
        req.session.userRole = user.role;
        
        // Force the session to be saved right away
        req.session.save((err) => {
          if (err) {
            console.error('Error saving session:', err);
            return next(err);
          }
          
          console.log('User registered and authenticated successfully with ID:', user.id);
          console.log('Session saved with userId:', req.session.userId);
          
          // Return user without password
          const { password, ...userWithoutPassword } = user;
          res.status(201).json(userWithoutPassword);
        });
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: "Invalid input data", errors: error.errors });
      }
      next(error);
    }
  });

  // User login endpoint
  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err: Error | null, user: SelectUser | false, info: { message?: string } | undefined) => {
      if (err) return next(err);
      if (!user) return res.status(401).json({ message: info?.message || "Authentication failed" });
      
      req.login(user, (err: Error | null) => {
        if (err) return next(err);
        
        // Store user ID and role in session for authentication
        req.session.userId = user.id;
        req.session.userRole = user.role;
        
        // Force the session to be saved right away
        req.session.save((err) => {
          if (err) {
            console.error('Error saving session:', err);
            return next(err);
          }
          
          console.log('User authenticated successfully with ID:', user.id);
          console.log('Session saved with userId:', req.session.userId);

          // Return user without password
          const { password, ...userWithoutPassword } = user;
          return res.json(userWithoutPassword);
        });
      });
    })(req, res, next);
  });

  // User logout endpoint
  app.post("/api/logout", (req, res, next) => {
    const sessionId = req.sessionID;
    console.log(`Processing logout request for session: ${sessionId}`);
    
    // Clear userId and userRole from session
    if (req.session) {
      console.log(`Clearing session data for userId: ${req.session.userId}`);
      req.session.userId = undefined;
      req.session.userRole = undefined;
      
      // Clear the entire session to be thorough
      req.session.destroy((err) => {
        if (err) {
          console.error('Error destroying session on logout:', err);
        } else {
          console.log('Session destroyed successfully');
        }
        
        // Always continue with the logout process even if session destruction fails
        req.logout((logoutErr) => {
          if (logoutErr) {
            console.error('Error during logout:', logoutErr);
            return next(logoutErr);
          }
          
          console.log('User logged out successfully');
          
          // Clear any cookies
          res.clearCookie('connect.sid');
          res.clearCookie('session');
          
          // Send success response
          res.status(200).json({ success: true, message: 'Logged out successfully' });
        });
      });
    } else {
      // If no session exists, just proceed with logout
      req.logout((err) => {
        if (err) return next(err);
        console.log('User logged out without active session');
        res.status(200).json({ success: true, message: 'Logged out successfully' });
      });
    }
  });

  // Session restore endpoint (special backdoor for client-side state recovery)
  app.post("/api/session/restore", async (req, res, next) => {
    try {
      const { userId, username } = req.body;
      
      if (!userId || !username) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      
      // Get the user from storage
      const user = await storage.getUser(userId);
      
      if (!user || user.username !== username) {
        return res.status(401).json({ message: "Invalid session restore attempt" });
      }
      
      // Log the user in directly
      req.login(user, (err) => {
        if (err) return next(err);
        
        // Store user ID and role in session for authentication
        req.session.userId = user.id;
        req.session.userRole = user.role;
        
        // Force the session to be saved right away
        req.session.save((err) => {
          if (err) {
            console.error('Error saving session on restore:', err);
            return next(err);
          }
          
          console.log('Session restored successfully for user ID:', user.id);
          
          // Return user without password
          const { password, ...userWithoutPassword } = user;
          return res.json(userWithoutPassword);
        });
      });
    } catch (error) {
      console.error('Session restore error:', error);
      next(error);
    }
  });

  // Get current user endpoint with header-based fallback auth
  app.get("/api/user", async (req, res) => {
    // First try standard session-based authentication
    if (req.isAuthenticated()) {
      // Return user without password
      const { password, ...userWithoutPassword } = req.user as SelectUser;
      return res.json(userWithoutPassword);
    }
    
    // Debug: Log session information
    console.log('Auth check - Session:', req.session ? 'exists' : 'none');
    console.log('Auth check - UserId:', req.session?.userId || 'none');
    console.log('Auth check - IsAuthenticated:', req.isAuthenticated() ? 'yes' : 'no');
    
    // If not authenticated via session, check for header-based auth
    const headerUserId = req.header('X-Auth-User-Id');
    const headerUsername = req.header('X-Auth-Username');
    
    if (headerUserId && headerUsername) {
      console.log('Auth check - Using header-based authentication for /api/user');
      
      try {
        // Validate the header credentials
        const userId = parseInt(headerUserId, 10);
        if (isNaN(userId)) {
          return res.status(401).json({ message: 'Invalid user ID in header' });
        }
        
        // Verify user exists
        const user = await storage.getUser(userId);
        if (!user || user.username !== headerUsername) {
          return res.status(401).json({ message: 'Invalid authentication credentials' });
        }
        
        // If valid, store in session for future requests
        if (req.session) {
          req.session.userId = userId;
          req.session.userRole = user.role;
          
          // Save session immediately
          req.session.save((err) => {
            if (err) {
              console.error('Error saving session from header auth in /api/user:', err);
            } else {
              console.log('Session restored from header auth for user:', userId);
            }
          });
        }
        
        // Return user without password
        const { password, ...userWithoutPassword } = user;
        return res.json(userWithoutPassword);
      } catch (error) {
        console.error('Header auth validation error in /api/user:', error);
      }
    }
    
    // If we get here, neither session nor header auth was successful
    return res.status(401).json({ message: "Not authenticated" });
  });
}
