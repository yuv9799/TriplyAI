import { v4 as uuidv4 } from "uuid";
import { sql } from "../../db/client";
import { generateItinerary, generateSearchKeywords } from "../../services/gemini";
import { uploadImage } from "../../services/imagekit";
import { searchBestImage } from "../../services/unsplash";
import { getForecast } from "../../services/weather";
import { inngest } from "../client";

interface GenerateTripEvent {
    name: "trip/generate.requested";
    data: {
        tripId: string;
    };
}

export const generateTrip = inngest.createFunction(
    { id: "generate-trip" },
    { event: "trip/generate.requested" },
    async ({ event, step }) => {
        const { tripId } = event.data as GenerateTripEvent["data"];

        // Step 1: Fetch trip details
        const trip = await step.run("fetch-trip", async () => {
            const result = await sql`
                SELECT t.*, d.city, d.country, d.latitude, d.longitude
                FROM trips t
                JOIN destinations d ON t.destination_id = d.id
                WHERE t.id = ${tripId}
            `;
            return result[0];
        });

        if (!trip) {
            throw new Error(`Trip ${tripId} not found`);
        }

        // Step 2: Check if user is premium
        const user = await step.run("check-user-tier", async () => {
            const result = await sql`
                SELECT subscription_tier FROM users WHERE id = ${trip.user_id}
            `;
            return result[0];
        });

        const isPremium = user?.subscription_tier === "premium";

        // Step 3: Generate itinerary via Gemini
        const itinerary = await step.run("generate-itinerary", async () => {
            return generateItinerary(
                trip.city,
                trip.country,
                trip.total_days,
                trip.travelers,
                trip.budget,
                isPremium
            );
        });

        // Step 4: Save days and activities, fetch images and weather
        for (const dayData of itinerary.days) {
            await step.run(`save-day-${dayData.dayNumber}`, async () => {
                const dayId = uuidv4();
                const tripStartDate = new Date();
                const dayDate = new Date(tripStartDate);
                dayDate.setDate(dayDate.getDate() + dayData.dayNumber - 1);

                // Get weather for this day (premium only)
                let weatherSummary: string | null = null;
                let weatherIcon: string | null = null;
                if (isPremium && trip.latitude && trip.longitude) {
                    const weather = await getForecast(trip.latitude, trip.longitude, dayDate);
                    if (weather) {
                        weatherSummary = `${weather.summary}, ${Math.round(weather.temperature)}°C`;
                        weatherIcon = weather.icon;
                    }
                }

                // Insert day
                await sql`
                    INSERT INTO days (id, trip_id, day_number, date, weather_summary, weather_icon)
                    VALUES (${dayId}, ${tripId}, ${dayData.dayNumber}, ${dayDate.toISOString().split("T")[0]}, ${weatherSummary}, ${weatherIcon})
                `;

                // Insert activities
                for (let i = 0; i < dayData.activities.length; i++) {
                    const activity = dayData.activities[i];
                    const activityId = uuidv4();

                    // Get image for this activity
                    let imagekitUrl: string | null = null;
                    let unsplashUrl: string | null = null;

                    if (isPremium) {
                        const keywords = await generateSearchKeywords(
                            activity.name,
                            activity.type,
                            trip.city
                        );
                        const image = await searchBestImage(keywords, trip.city, activity.type);
                        if (image) {
                            unsplashUrl = image.url;
                            const uploaded = await uploadImage(
                                image.url,
                                `${tripId}-${dayData.dayNumber}-${i}`,
                                `trips/${tripId}`
                            );
                            if (uploaded) {
                                imagekitUrl = uploaded;
                            }
                        }
                    }

                    await sql`
                        INSERT INTO activities (id, day_id, type, name, description, start_time, end_time, cost_estimate, latitude, longitude, unsplash_image_url, imagekit_url, sort_order)
                        VALUES (${activityId}, ${dayId}, ${activity.type}, ${activity.name}, ${activity.description}, ${activity.startTime}, ${activity.endTime}, ${activity.costEstimate}, ${activity.latitude}, ${activity.longitude}, ${unsplashUrl}, ${imagekitUrl}, ${i})
                    `;
                }
            });
        }

        // Step 5: Update trip status to ready
        await step.run("mark-ready", async () => {
            await sql`
                UPDATE trips SET status = 'ready', updated_at = NOW() WHERE id = ${tripId}
            `;
        });

        // Step 6: Increment generation count
        await step.run("increment-count", async () => {
            await sql`
                UPDATE users SET generation_count = generation_count + 1 WHERE id = ${trip.user_id}
            `;
        });

        return { tripId, status: "ready" };
    }
);