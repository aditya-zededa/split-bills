import { NextRequest } from "next/server";
import { badRequest, ok, requireUser } from "@/lib/api";
import { transcribeAudio } from "@/lib/openai";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 20 * 1024 * 1024; // 20 MB
const ALLOWED_MIME = new Set([
  "audio/webm",
  "audio/ogg",
  "audio/mp3",
  "audio/mpeg",
  "audio/wav",
  "audio/mp4",
  "audio/m4a",
  "audio/x-m4a"
]);

export async function POST(req: NextRequest) {
  const { user, error } = await requireUser();
  if (error) return error;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return badRequest("invalid multipart body");
  }

  const file = form.get("audio");
  if (!(file instanceof File)) {
    return badRequest("missing 'audio' file field");
  }
  if (file.size === 0) return badRequest("empty audio");
  if (file.size > MAX_BYTES) return badRequest("audio too large (max 20 MB)");
  if (file.type && !ALLOWED_MIME.has(file.type)) {
    // Don't hard-fail; Whisper handles many formats. Just log.
    console.warn(`[transcribe] unexpected mime: ${file.type}`);
  }

  try {
    const transcript = await transcribeAudio(file);
    return ok({ transcript, userId: user.id });
  } catch (e) {
    console.error("[transcribe] failed", e);
    return badRequest("transcription failed", { message: (e as Error).message });
  }
}
