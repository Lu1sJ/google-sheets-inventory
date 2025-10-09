import type { Request, Response, NextFunction } from "express";
import { validateSession } from "../auth";
import type { User } from "@shared/schema";

export interface AuthenticatedRequest extends Request {
  user?: User & {
    sessionId: string;
  };
}

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const sessionId = req.session.sessionId;
    if (!sessionId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    const user = await validateSession(sessionId);
    if (!user) {
      req.session.sessionId = undefined;
      return res.status(401).json({ message: "Session expired" });
    }
    
    req.user = user;
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

export function requireRole(role: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    if (req.user.role !== role) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }
    
    next();
  };
}

export function requireRoles(roles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }
    
    next();
  };
}