import cors from "cors";
import "dotenv/config";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { errorHandler } from "./middleware/error";
import { paymentsRouter } from "./routes/payments";
import { tripsRouter } from "./routes/trips";
import { usersRouter } from "./routes/users";
import { clerkWebhookRouter } from "./routes/webhooks";

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan("dev"));

// Raw body parser for webhooks (must be before JSON parser)
app.use("/webhooks", express.raw({ type: "application/json" }));

// JSON parser for API routes
app.use(express.json());

// Routes
app.use("/webhooks/clerk", clerkWebhookRouter);
app.use("/api/trips", tripsRouter);
app.use("/api/users", usersRouter);
app.use("/api/payments", paymentsRouter);

// Health check
app.get("/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Error handler (must be last)
app.use(errorHandler);

app.listen(PORT, () => {
    console.log(`Triply API server running on port ${PORT}`);
});

export default app;