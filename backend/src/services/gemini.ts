import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const ITINERARY_PROMPT = `You are an expert travel planner. Generate a detailed day-by-day itinerary for a trip.
Return the response as a JSON object with this exact structure:
{
  "days": [
    {
      "dayNumber": 1,
      "activities": [
        {
          "type": "attraction" | "hotel" | "restaurant" | "transport",
          "name": "string",
          "description": "string (max 100 words)",
          "startTime": "09:00",
          "endTime": "10:30",
          "costEstimate": 0,
          "latitude": 0.0,
          "longitude": 0.0
        }
      ]
    }
  ]
}

Important rules:
- Include realistic places that exist in the destination
- Provide real coordinate values for map placement
- Balance each day with a mix of activities
- Keep descriptions concise but informative
- Include meal times at local restaurants
- Add a hotel at the end of each day`;

export interface ActivityInput {
    type: "hotel" | "restaurant" | "attraction" | "transport";
    name: string;
    description: string;
    startTime: string;
    endTime: string;
    costEstimate: number;
    latitude: number;
    longitude: number;
}

export interface DayInput {
    dayNumber: number;
    activities: ActivityInput[];
}

export interface ItineraryInput {
    days: DayInput[];
}

export async function generateItinerary(
    city: string,
    country: string,
    totalDays: number,
    travelers: number,
    budget?: string,
    isPremium: boolean = false
): Promise<ItineraryInput> {
    const maxActivitiesPerDay = isPremium ? 10 : 5;
    const wordLimit = isPremium ? 100 : 50;

    const prompt = `${ITINERARY_PROMPT}

Trip Details:
- Destination: ${city}, ${country}
- Duration: ${totalDays} day(s)
- Travelers: ${travelers}
- Budget: ${budget || "Not specified"}
- Max activities per day: ${maxActivitiesPerDay}
- Description word limit: ${wordLimit} words

Generate a JSON itinerary for this trip.`;

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
        const result = await model.generateContent(prompt);
        const response = result.response;
        const text = response.text();

        // Extract JSON from response (it might be wrapped in markdown code blocks)
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error("No JSON found in Gemini response");
        }

        const itinerary: ItineraryInput = JSON.parse(jsonMatch[0]);
        return itinerary;
    } catch (error) {
        console.error("Gemini itinerary generation failed:", error);
        throw new Error("Failed to generate itinerary");
    }
}

export async function regenerateItinerary(
    existingTrip: ItineraryInput,
    editInstructions: string,
    isPremium: boolean
): Promise<ItineraryInput> {
    const prompt = `${ITINERARY_PROMPT}

Existing Itinerary:
${JSON.stringify(existingTrip, null, 2)}

User Edit Instructions:
${editInstructions}

Modify the itinerary according to the instructions above. Preserve as much of the existing structure as possible. Return the complete updated JSON.`;

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
        const result = await model.generateContent(prompt);
        const response = result.response;
        const text = response.text();

        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error("No JSON found in Gemini response");
        }

        const itinerary: ItineraryInput = JSON.parse(jsonMatch[0]);
        return itinerary;
    } catch (error) {
        console.error("Gemini regeneration failed:", error);
        throw new Error("Failed to regenerate itinerary");
    }
}

export async function generateSearchKeywords(
    activityName: string,
    activityType: string,
    city: string
): Promise<string[]> {
    const prompt = `Generate 3 search keywords for finding a photo of "${activityName}" (a ${activityType} in ${city}) on Unsplash.
Return only a JSON array of strings, nothing else.
Example: ["tokyo restaurant interior", "japanese cuisine dining", "modern tokyo cafe"]`;

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent(prompt);
        const text = result.response.text();

        const keywords: string[] = JSON.parse(text);
        return keywords.slice(0, 3);
    } catch (error) {
        console.error("Keyword generation failed:", error);
        return [`${city} ${activityType}`];
    }
}