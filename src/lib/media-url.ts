export function getSafeMediaUrl(url: string | null | undefined): string | undefined {
    if (!url) return undefined;

    let cleanUrl = url.trim();

    if (typeof window !== "undefined") {
        const origin = window.location.origin;
        if (cleanUrl.startsWith(origin)) {
            cleanUrl = cleanUrl.replace(origin, "");
        }
    }

    if (cleanUrl.includes("localhost:3000")) {
        cleanUrl = cleanUrl.replace(/https?:\/\/localhost:3000/, "");
    }

    if (cleanUrl.includes("/uploads/") && cleanUrl.startsWith("http")) {
        cleanUrl = cleanUrl.substring(cleanUrl.indexOf("/uploads/"));
    }

    if (cleanUrl.startsWith("/uploads/")) {
        const filename = cleanUrl.substring("/uploads/".length);
        return `/api/media/${filename}`;
    }

    return cleanUrl;
}
