"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Square, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

const MAX_SECONDS = 60;

type Status = "idle" | "recording" | "stopped" | "error";

export function AudioRecorder({
  onAudioReady
}: {
  onAudioReady: (blob: Blob, mimeType: string) => void;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cleanupStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => cleanupStream, [cleanupStream]);

  async function start() {
    setError(null);
    chunksRef.current = [];
    setSeconds(0);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const rec = new MediaRecorder(stream, { mimeType: mime });
      recorderRef.current = rec;

      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mime });
        cleanupStream();
        setStatus("stopped");
        onAudioReady(blob, mime);
      };

      rec.start();
      setStatus("recording");

      timerRef.current = setInterval(() => {
        setSeconds((s) => {
          const next = s + 1;
          if (next >= MAX_SECONDS) stop();
          return next;
        });
      }, 1000);
    } catch (e) {
      setError((e as Error).message || "mic access denied");
      setStatus("error");
    }
  }

  function stop() {
    recorderRef.current?.state !== "inactive" && recorderRef.current?.stop();
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setStatus("stopped");
    onAudioReady(f, f.type || "audio/webm");
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-center py-6">
        {status === "recording" ? (
          <Button
            type="button"
            size="lg"
            variant="destructive"
            onClick={stop}
            className="w-full h-14 text-base"
          >
            <Square className="w-5 h-5 mr-2" />
            Stop ({seconds}s / {MAX_SECONDS}s)
          </Button>
        ) : (
          <Button
            type="button"
            size="lg"
            onClick={start}
            className="w-full h-14 text-base"
          >
            <Mic className="w-5 h-5 mr-2" />
            {status === "stopped" ? "Record again" : "Start recording"}
          </Button>
        )}
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="flex-1 h-px bg-border" />
        <span>or</span>
        <span className="flex-1 h-px bg-border" />
      </div>

      <label className="flex items-center justify-center gap-2 border-2 border-dashed rounded-md p-4 cursor-pointer hover:bg-accent text-sm">
        <Upload className="w-4 h-4" />
        <span>Upload audio file</span>
        <input
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={onFile}
        />
      </label>

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
