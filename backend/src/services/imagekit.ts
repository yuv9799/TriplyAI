import ImageKit from "imagekit";

const imagekit = new ImageKit({
    publicKey: process.env.IMAGEKIT_PUBLIC_KEY!,
    privateKey: process.env.IMAGEKIT_PRIVATE_KEY!,
    urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT!,
});

export async function uploadImage(
    imageUrl: string,
    fileName: string,
    folder: string = "trips"
): Promise<string | null> {
    try {
        // Download image from URL
        const response = await fetch(imageUrl);
        const buffer = Buffer.from(await response.arrayBuffer());

        // Upload to ImageKit
        const result = await imagekit.upload({
            file: buffer,
            fileName: `${fileName}.jpg`,
            folder: `/${folder}`,
            useUniqueFileName: true,
        });

        return result.url;
    } catch (error) {
        console.error("ImageKit upload failed:", error);
        return null;
    }
}

export function getImageUrl(
    imagekitUrl: string,
    width: number = 400,
    height: number = 300
): string {
    // ImageKit transformations via URL parameters
    const baseUrl = imagekitUrl.replace(/^https?:\/\//, "");
    return `https://${baseUrl}?tr=w-${width},h-${height},c-at_max`;
}

export function getThumbnailUrl(imagekitUrl: string): string {
    const baseUrl = imagekitUrl.replace(/^https?:\/\//, "");
    return `https://${baseUrl}?tr=w-150,h-150,c-at_max`;
}