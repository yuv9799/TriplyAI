const WEATHER_API = "https://api.openweathermap.org/data/2.5";

interface WeatherData {
    summary: string;
    icon: string;
    temperature: number;
    feelsLike: number;
    humidity: number;
}

export async function getForecast(
    lat: number,
    lon: number,
    date: Date
): Promise<WeatherData | null> {
    try {
        const apiKey = process.env.OPENWEATHERMAP_API_KEY;
        if (!apiKey) {
            console.warn("OPENWEATHERMAP_API_KEY not configured");
            return null;
        }

        const response = await fetch(
            `${WEATHER_API}/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`
        );

        if (!response.ok) {
            console.error(`Weather API error: ${response.status}`);
            return null;
        }

        const data = await response.json() as {
            list: Array<{
                dt: number;
                main: { temp: number; feels_like: number; humidity: number };
                weather: Array<{ main: string; icon: string; description: string }>;
            }>;
        };

        // Find the forecast closest to the target date
        const targetTimestamp = date.getTime() / 1000;
        const closest = data.list.reduce((prev, curr) => {
            return Math.abs(curr.dt - targetTimestamp) < Math.abs(prev.dt - targetTimestamp)
                ? curr
                : prev;
        });

        return {
            summary: closest.weather[0]?.description || "Unknown",
            icon: closest.weather[0]?.icon || "01d",
            temperature: closest.main.temp,
            feelsLike: closest.main.feels_like,
            humidity: closest.main.humidity,
        };
    } catch (error) {
        console.error("Weather fetch failed:", error);
        return null;
    }
}