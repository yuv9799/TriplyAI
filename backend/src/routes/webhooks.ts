import { Request, Response, Router } from "express";
import { sql } from "../db/client";

export const clerkWebhookRouter = Router();

// Clerk webhook - receives user created/updated/deleted events
clerkWebhookRouter.post("/", async (req: Request, res: Response) => {
    try {
        const payload = req.body;
        const { type, data } = payload;

        switch (type) {
            case "user.created": {
                const { id, email_addresses, first_name, last_name, image_url } = data;
                const email = email_addresses?.[0]?.email_address || "";
                const name = [first_name, last_name].filter(Boolean).join(" ");

                await sql`
                    INSERT INTO users (id, email, name, avatar_url)
                    VALUES (${id}, ${email}, ${name || null}, ${image_url || null})
                    ON CONFLICT (id) DO UPDATE 
                    SET email = ${email}, name = ${name || null}, avatar_url = ${image_url || null}
                `;
                console.log(`User created/updated: ${id}`);
                break;
            }

            case "user.updated": {
                const { id, email_addresses, first_name, last_name, image_url } = data;
                const email = email_addresses?.[0]?.email_address || "";

                await sql`
                    UPDATE users 
                    SET email = ${email}, name = ${[first_name, last_name].filter(Boolean).join(" ") || null}, 
                        avatar_url = ${image_url || null}, updated_at = NOW()
                    WHERE id = ${id}
                `;
                break;
            }

            case "user.deleted": {
                const { id } = data;
                await sql`DELETE FROM users WHERE id = ${id}`;
                console.log(`User deleted: ${id}`);
                break;
            }
        }

        res.json({ success: true });
    } catch (error) {
        console.error("Clerk webhook error:", error);
        res.status(500).json({ error: "Webhook processing failed" });
    }
});