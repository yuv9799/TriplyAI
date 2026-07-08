import { createHmac } from "crypto";
import { Request, Response, Router } from "express";
import Razorpay from "razorpay";
import { sql } from "../db/client";
import { requireAuth } from "../middleware/auth";

export const paymentsRouter = Router();

paymentsRouter.use(requireAuth);

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID!,
    key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

// POST /api/payments/razorpay/create-order - Create Razorpay order
paymentsRouter.post("/razorpay/create-order", async (req: Request, res: Response) => {
    const userId = req.userId!;
    const { planType } = req.body; // 'monthly' | 'yearly'

    const amount = planType === "yearly" ? 299900 : 29900; // ₹2999/yr or ₹299/mo (in paise)

    try {
        const order = await razorpay.orders.create({
            amount,
            currency: "INR",
            receipt: `receipt_${userId}_${Date.now()}`,
            notes: {
                userId,
                planType: planType || "monthly",
            },
        });

        res.json({
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
            keyId: process.env.RAZORPAY_KEY_ID,
        });
    } catch (error) {
        console.error("Razorpay order creation failed:", error);
        res.status(500).json({ error: "Payment order creation failed" });
    }
});

// POST /api/payments/razorpay/verify - Verify Razorpay payment
paymentsRouter.post("/razorpay/verify", async (req: Request, res: Response) => {
    const userId = req.userId!;
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, planType } = req.body;

    // Verify signature
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
        .update(body)
        .digest("hex");

    if (expectedSignature !== razorpay_signature) {
        res.status(400).json({ error: "Invalid payment signature" });
        return;
    }

    try {
        // Fetch payment details from Razorpay
        const payment = await razorpay.payments.fetch(razorpay_payment_id);

        // Calculate subscription period (30 days from now)
        const now = new Date();
        const periodEnd = new Date(now);
        periodEnd.setDate(periodEnd.getDate() + 30);

        // Insert subscription record
        await sql`
            INSERT INTO subscriptions (user_id, provider, provider_subscription_id, provider_customer_id, status, plan_type, current_period_start, current_period_end)
            VALUES (${userId}, 'razorpay', ${razorpay_payment_id}, ${payment.id}, 'active', ${planType || "monthly"}, ${now.toISOString()}, ${periodEnd.toISOString()})
            ON CONFLICT (user_id, provider) 
            DO UPDATE SET status = 'active', provider_subscription_id = ${razorpay_payment_id}, current_period_end = ${periodEnd.toISOString()}, updated_at = NOW()
        `;

        // Update user subscription tier
        await sql`UPDATE users SET subscription_tier = 'premium', updated_at = NOW() WHERE id = ${userId}`;

        res.json({ success: true, subscriptionTier: "premium" });
    } catch (error) {
        console.error("Payment verification failed:", error);
        res.status(500).json({ error: "Payment verification failed" });
    }
});