import { Request, Response, Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { sql } from "../db/client";
import { requireAuth } from "../middleware/auth";

export const tripsRouter = Router();

// All trip routes require auth
tripsRouter.use(requireAuth);

// Generate trip schema
const generateTripSchema = z.object({
    destination: z.object({
        city: z.string().min(1),
        country: z.string().min(1),
    }),
    totalDays: z.number().int().min(1).max(14),
    travelers: z.number().int().min(1),
    budget: z.string().optional(),
});

// POST /api/trips/generate - Submit trip generation request
tripsRouter.post("/generate", async (req: Request, res: Response) => {
    const parsed = generateTripSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
        return;
    }

    const { destination, totalDays, travelers, budget } = parsed.data;
    const userId = req.userId!;

    // Check generation limits
    const user = await sql`SELECT subscription_tier, generation_count FROM users WHERE id = ${userId}`;
    if (user.length === 0) {
        res.status(404).json({ error: "User not found" });
        return;
    }

    const { subscription_tier, generation_count } = user[0];
    if (subscription_tier === "free" && generation_count >= 3) {
        res.status(403).json({ error: "Free limit reached. Upgrade to Premium." });
        return;
    }

    // Find or create destination
    let destResult = await sql`
        SELECT id FROM destinations WHERE LOWER(city) = LOWER(${destination.city}) AND LOWER(country) = LOWER(${destination.country})
    `;

    let destinationId: string;
    if (destResult.length === 0) {
        destinationId = uuidv4();
        await sql`
            INSERT INTO destinations (id, city, country, latitude, longitude)
            VALUES (${destinationId}, ${destination.city}, ${destination.country}, 0, 0)
        `;
    } else {
        destinationId = destResult[0].id;
    }

    // Create trip
    const tripId = uuidv4();
    await sql`
        INSERT INTO trips (id, user_id, destination_id, title, status, total_days, travelers, budget)
        VALUES (${tripId}, ${userId}, ${destinationId}, ${`${destination.city} Trip`}, 'generating', ${totalDays}, ${travelers}, ${budget || null})
    `;

    // TODO: Enqueue Inngest event for generation
    // For now, we'll mark as ready with mock data
    // await inngest.send({ name: "trip/generate.requested", data: { tripId } });

    res.status(201).json({
        tripId,
        status: "generating",
        message: "Trip generation started",
    });
});

// GET /api/trips - List user's trips
tripsRouter.get("/", async (req: Request, res: Response) => {
    const userId = req.userId!;
    const trips = await sql`
        SELECT t.*, d.city, d.country 
        FROM trips t 
        JOIN destinations d ON t.destination_id = d.id 
        WHERE t.user_id = ${userId}
        ORDER BY t.created_at DESC
    `;

    res.json({ trips });
});

// GET /api/trips/:id/status - Poll trip generation status
tripsRouter.get("/:id/status", async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = req.userId!;

    const trip = await sql`
        SELECT id, status, error_message FROM trips WHERE id = ${id} AND user_id = ${userId}
    `;

    if (trip.length === 0) {
        res.status(404).json({ error: "Trip not found" });
        return;
    }

    res.json({ status: trip[0].status, errorMessage: trip[0].error_message });
});

// GET /api/trips/:id - Get full trip details
tripsRouter.get("/:id", async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = req.userId!;

    const trip = await sql`
        SELECT t.*, d.city, d.country, d.latitude, d.longitude, d.timezone, d.currency, d.language, d.description
        FROM trips t 
        JOIN destinations d ON t.destination_id = d.id 
        WHERE t.id = ${id} AND t.user_id = ${userId}
    `;

    if (trip.length === 0) {
        res.status(404).json({ error: "Trip not found" });
        return;
    }

    const days = await sql`
        SELECT * FROM days WHERE trip_id = ${id} ORDER BY day_number ASC
    `;

    const dayIds = days.map((d: any) => d.id);
    let activities: any[] = [];
    if (dayIds.length > 0) {
        activities = await sql`
            SELECT * FROM activities WHERE day_id = ANY(${dayIds}) ORDER BY sort_order ASC
        `;
    }

    res.json({
        trip: trip[0],
        days: days.map((day: any) => ({
            ...day,
            activities: activities.filter((a: any) => a.day_id === day.id),
        })),
    });
});

// DELETE /api/trips/:id
tripsRouter.delete("/:id", async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = req.userId!;

    const result = await sql`
        DELETE FROM trips WHERE id = ${id} AND user_id = ${userId}
        RETURNING id
    `;

    if (result.length === 0) {
        res.status(404).json({ error: "Trip not found" });
        return;
    }

    res.json({ message: "Trip deleted" });
});

// POST /api/trips/:id/share - Generate share token
tripsRouter.post("/:id/share", async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = req.userId!;
    const shareToken = uuidv4().replace(/-/g, "").substring(0, 12);

    const result = await sql`
        UPDATE trips SET share_token = ${shareToken}, is_public = true 
        WHERE id = ${id} AND user_id = ${userId}
        RETURNING share_token
    `;

    if (result.length === 0) {
        res.status(404).json({ error: "Trip not found" });
        return;
    }

    res.json({ shareToken: result[0].share_token });
});