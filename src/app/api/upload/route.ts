// API route for uploading media files
import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { existsSync } from "fs";

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get("file") as File;

        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        // Create uploads directory if it doesn't exist
        const uploadsDir = path.join(process.cwd(), "public", "uploads");
        if (!existsSync(uploadsDir)) {
            await mkdir(uploadsDir, { recursive: true });
        }

        // Generate unique filename
        const ext = path.extname(file.name);
        const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(7)}${ext}`;
        const filePath = path.join(uploadsDir, uniqueName);

        // Write file to disk
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        await writeFile(filePath, buffer);

        // Return the media API URL so external providers can download it reliably.
        const publicUrl = `/api/media/${uniqueName}`;

        // Determine media type category
        let mediaCategory = "document";
        if (file.type.startsWith("image/")) mediaCategory = "image";
        else if (file.type.startsWith("audio/")) mediaCategory = "audio";
        else if (file.type.startsWith("video/")) mediaCategory = "video";

        console.log("[Upload] File saved:", uniqueName, "type:", mediaCategory);

        return NextResponse.json({
            success: true,
            url: publicUrl,
            fileName: file.name,
            mimeType: file.type,
            mediaCategory,
        });
    } catch (error) {
        console.error("[Upload] Error:", error);
        return NextResponse.json(
            { error: "Failed to upload file" },
            { status: 500 }
        );
    }
}
