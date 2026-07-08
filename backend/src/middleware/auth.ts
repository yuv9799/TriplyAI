import { clerkClient } from "@clerk/clerk-sdk-node";
import { NextFunction, Request, Response } from "express";

// Extend Express Request to include user
declare global {
    namespace Express {
        interface Request {
            userId?: string;
        }
    }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith("Bearer ")) {
            res.status(401).json({ error: "Missing or invalid authorization header" });
            return;
        }

        const token = authHeader.split(" ")[1];
        const session = await clerkClient.sessions.verifySession(token);

        if (!session?.userId) {
            res.status(401).json({ error: "Invalid session" });
            return;
        }

        req.userId = session.userId;
        next();
    } catch (error) {
        console.error("Auth error:", error);
        res.status(401).json({ error: "Authentication failed" });
    }
}