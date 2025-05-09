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
    // Clear userId and userRole from session
    if (req.session) {
      req.session.userId = undefined;
      req.session.userRole = undefined;
    }
    
    req.logout((err) => {
      if (err) return next(err);
      
      // Force the session to be saved right away
      if (req.session) {
        req.session.save((err) => {
          if (err) {
            console.error('Error saving session on logout:', err);
            return next(err);
          }
          
          console.log('User logged out successfully');
          res.sendStatus(200);
        });
      } else {
        res.sendStatus(200);
      }
    });
  });

  // Get current user endpoint
  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    // Return user without password
    const { password, ...userWithoutPassword } = req.user as SelectUser;
    res.json(userWithoutPassword);
  });
}
