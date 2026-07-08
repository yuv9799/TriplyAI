import { Request, Response, Router } from "express";
import { sql } from "../db/client";
import { requireAuth } from "../middleware/auth";

export const usersRouter = Router();

usersRouter.use(requireAuth);

// GET /api/users/me - Get current user profile
usersRouter.get("/me", async (req: Request, res: Response) => {
    const userId = req.userId!;

    const user = await sql`
        SELECT id, email, name, avatar_url, subscription_tier, generation_count, created_at
        FROM users WHERE id = ${userId}
    `;

    if (user.length === 0) {
        res.status(404).json({ error: "User not found" });
        return;
    }

    res.json({ user: user[0] });
});

// POST /api/users/me/refresh-subscription - Force re-sync subscription tier
usersRouter.post("/me/refresh-subscription", async (req: Request, res: Response) => {
    const userId = req.userId!;

    // Check active subscriptions in the subscriptions table
    const activeSub = await sql`
        SELECT provider, plan_type, current_period_end 
        FROM subscriptions 
        WHERE user_id = ${userId} AND status = 'active'
        ORDER BY current_period_end DESC 
        LIMIT 1
    `;

    if (activeSub.length > 0 && new Date(activeSub[0].current_period_end) > new Date()) {
        await sql`UPDATE users SET subscription_tier = 'premium' WHERE id = ${userId}`;
        res.json({ subscriptionTier: "premium", provider: activeSub[0].provider });
    } else {
        await sql`UPDATE users SET subscription_tier = 'free' WHERE id = ${userId}`;
        res.json({ subscriptionTier: "free" });
    }
});

// POST /api/users/me/update-profile - Update user profile
usersRouter.post("/me/update-profile", async (req: Request, res: Response) => {
    const userId = req.userId!;
    const { name } = req.body;

    if (name) {
        await sql`UPDATE users SET name = ${name}, updated_at = NOW() WHERE id = ${userId}`;
    }

    res.json({ message: "Profile updated" });
});