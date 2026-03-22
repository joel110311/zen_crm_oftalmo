import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import os from "os";
import path from "path";
import { spawn } from "child_process";
import ffmpegPath from "ffmpeg-static";

const MIME_BY_EXTENSION: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".pdf": "application/pdf",
    ".txt": "text/plain",
    ".md": "text/markdown",
    ".csv": "text/csv",
    ".json": "application/json",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".ogg": "audio/ogg",
    ".oga": "audio/ogg",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".m4a": "audio/mp4",
    ".aac": "audio/aac",
    ".mp4": "video/mp4",
    ".mov": "video/quicktime",
    ".webm": "video/webm",
};

function inferMimeType(fileName: string, explicitMimeType?: string | null) {
    if (explicitMimeType) return explicitMimeType;
    const extension = path.extname(fileName).toLowerCase();
    return MIME_BY_EXTENSION[extension] || "application/octet-stream";
}

function fileNameFromUrl(mediaUrl: string) {
    const clean = mediaUrl.split("?")[0];
    return path.basename(clean);
}

function isHttpUrl(value: string) {
    return /^https?:\/\//i.test(value);
}

function localUploadPathFromUrl(mediaUrl: string) {
    const fileName = fileNameFromUrl(mediaUrl);
    return path.join(process.cwd(), "public", "uploads", fileName);
}

async function convertAudioBufferToOgg(
    buffer: Buffer,
    fileName: string,
    mimeType: string,
) {
    if (!mimeType.startsWith("audio/") || !ffmpegPath) {
        return null;
    }

    const ffmpegExecutable = ffmpegPath;
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "zencrm-audio-"));
    const inputExtension = path.extname(fileName) || ".bin";
    const inputPath = path.join(tempDir, `input${inputExtension}`);
    const outputPath = path.join(tempDir, "output.ogg");

    try {
        await writeFile(inputPath, buffer);

        await new Promise<void>((resolve, reject) => {
            const process = spawn(ffmpegExecutable, [
                "-y",
                "-i",
                inputPath,
                "-c:a",
                "libopus",
                "-b:a",
                "32k",
                "-vbr",
                "on",
                outputPath,
            ]);

            let stderr = "";
            process.stderr.on("data", (chunk) => {
                stderr += chunk.toString();
            });
            process.on("error", reject);
            process.on("close", (code) => {
                if (code === 0) {
                    resolve();
                    return;
                }
                reject(new Error(stderr || `FFmpeg termino con codigo ${code}`));
            });
        });

        const convertedBuffer = await readFile(outputPath);
        return {
            buffer: convertedBuffer,
            fileName: `${path.parse(fileName).name || "audio"}.ogg`,
            mimeType: "audio/ogg",
        };
    } finally {
        await rm(tempDir, { recursive: true, force: true });
    }
}

async function finalizeMedia(
    buffer: Buffer,
    fileName: string,
    mimeType: string,
) {
    const convertedAudio = await convertAudioBufferToOgg(buffer, fileName, mimeType).catch(() => null);
    const finalBuffer = convertedAudio?.buffer || buffer;
    const finalFileName = convertedAudio?.fileName || fileName;
    const finalMimeType = convertedAudio?.mimeType || mimeType;

    return {
        dataUrl: `data:${finalMimeType};base64,${finalBuffer.toString("base64")}`,
        fileName: finalFileName,
        mimeType: finalMimeType,
    };
}

export async function resolveMediaToDataUrl(
    mediaUrl: string,
    explicitMimeType?: string | null,
) {
    if (mediaUrl.startsWith("data:")) {
        const mimeType = mediaUrl.slice(5, mediaUrl.indexOf(";")) || "application/octet-stream";
        return {
            dataUrl: mediaUrl,
            fileName: "archivo",
            mimeType,
        };
    }

    const fileName = fileNameFromUrl(mediaUrl);
    const mimeType = inferMimeType(fileName, explicitMimeType);

    if (mediaUrl.includes("/uploads/") || mediaUrl.startsWith("/")) {
        const buffer = await readFile(localUploadPathFromUrl(mediaUrl));
        return finalizeMedia(buffer, fileName, mimeType);
    }

    if (isHttpUrl(mediaUrl)) {
        const response = await fetch(mediaUrl, { cache: "no-store" });
        if (!response.ok) {
            throw new Error(`No pude descargar el archivo desde ${mediaUrl}`);
        }

        const responseMimeType = response.headers.get("content-type") || mimeType;
        const buffer = Buffer.from(await response.arrayBuffer());
        return finalizeMedia(buffer, fileName, responseMimeType);
    }

    throw new Error("No pude resolver el archivo multimedia.");
}
