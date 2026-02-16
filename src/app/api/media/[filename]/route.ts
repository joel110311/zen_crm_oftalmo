// API route to serve media files with correct Content-Type headers
// This avoids ngrok free-tier interstitial page issues that affect static files
import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const MIME_TYPES: Record<string, string> = {
    ".m4a": "audio/mp4",
    ".mp3": "audio/mpeg",
    ".ogg": "audio/ogg",
    ".opus": "audio/ogg",
    ".wav": "audio/wav",
    ".aac": "audio/aac",
    ".amr": "audio/amr",
    ".webm": "audio/webm",
    ".mp4": "video/mp4",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".pdf": "application/pdf",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ filename: string }> }
) {
    const { filename } = await params;

    // Security: only allow alphanumeric, dash, underscore, dot
    if (!/^[\w\-\.]+$/.test(filename)) {
        return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
    }

    const filePath = path.join(process.cwd(), "public", "uploads", filename);

    if (!fs.existsSync(filePath)) {
        return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const fileBuffer = fs.readFileSync(filePath);
    const ext = path.extname(filename).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    console.log(`[MEDIA] Serving ${filename} as ${contentType} (${fileBuffer.length} bytes)`);

    return new NextResponse(fileBuffer, {
        status: 200,
        headers: {
            "Content-Type": contentType,
            "Content-Length": fileBuffer.length.toString(),
            "Content-Disposition": `inline; filename="${filename}"`,
            "Cache-Control": "public, max-age=86400",
            "Access-Control-Allow-Origin": "*",
        },
    });
}
