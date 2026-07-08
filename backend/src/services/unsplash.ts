const UNSPLASH_API = "https://api.unsplash.com";

interface UnsplashImage {
    url: string;
    thumbUrl: string;
    author: string;
    authorUrl: string;
}

export async function searchImage(
    query: string,
    orientation: "landscape" | "portrait" | "squarish" = "landscape"
): Promise<UnsplashImage | null> {
    try {
        const response = await fetch(
            `${UNSPLASH_API}/search/photos?query=${encodeURIComponent(query)}&per_page=1&orientation=${orientation}`,
            {
                headers: {
                    Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}`,
                },
            }
        );

        if (!response.ok) {
            console.error(`Unsplash API error: ${response.status}`);
            return null;
        }

        const data = (await response.json()) as { results?: Array<{ urls: { regular: string; thumb: string }; user: { name: string; links: { html: string } } }> };
        if (data.results && data.results.length > 0) {
            const photo = data.results[0];
            return {
                url: photo.urls.regular,
                thumbUrl: photo.urls.thumb,
                author: photo.user.name,
                authorUrl: photo.user.links.html,
            };
        }

        return null;
    } catch (error) {
        console.error("Unsplash search failed:", error);
        return null;
    }
}

export async function searchBestImage(
    keywords: string[],
    city: string,
    activityType: string
): Promise<UnsplashImage | null> {
    // Try each keyword until we find an image
    for (const keyword of keywords) {
        const image = await searchImage(keyword);
        if (image) return image;
    }

    // Fallback to a generic search
    const fallbackImage = await searchImage(`${city} ${activityType}`);
    return fallbackImage;
}