"use client";

import { useState } from "react";
import { AudioRecorder } from "./audio-recorder";
import { ExpenseForm } from "./expense-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";

type Member = { id: string; name: string | null; email: string };

type Stage = "idle" | "transcribing" | "review-transcript" | "parsing" | "review-expense" | "error";

type Proposal = {
  description: string;
  amountPaise: number;
  payerId: string | null;
  splitMode: "EQUAL" | "AMOUNT" | "PERCENT";
  participants: string[];
  customShares?: Array<{ userId: string; value: number }> | null;
  confidence: "high" | "medium" | "low";
  notes?: string;
};

export function AudioTab({
  groupId,
  members,
  currentUserId
}: {
  groupId: string;
  members: Member[];
  currentUserId: string;
}) {
  const [stage, setStage] = useState<Stage>("idle");
  const [transcript, setTranscript] = useState("");
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [audioTranscript, setAudioTranscript] = useState<string | null>(null);

  async function onAudioReady(blob: Blob, mime: string) {
    setError(null);
    setStage("transcribing");

    const ext = mime.includes("webm") ? "webm" : mime.includes("mp4") ? "m4a" : "audio";
    const file = new File([blob], `recording.${ext}`, { type: mime });
    const form = new FormData();
    form.append("audio", file);

    try {
      const res = await fetch("/api/audio/transcribe", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "transcribe failed");
      setTranscript(data.transcript ?? "");
      setStage("review-transcript");
    } catch (e) {
      const msg = (e as Error).message;
      setError(msg);
      setStage("error");
      toast.error("Transcription failed", msg);
    }
  }

  async function parse() {
    if (!transcript.trim()) return;
    setStage("parsing");
    setError(null);
    try {
      const res = await fetch("/api/audio/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript, groupId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "parse failed");
      setProposal(data.proposal as Proposal);
      setAudioTranscript(transcript);
      setStage("review-expense");
    } catch (e) {
      const msg = (e as Error).message;
      setError(msg);
      setStage("error");
      toast.error("Parse failed", msg);
    }
  }

  function reset() {
    setStage("idle");
    setTranscript("");
    setProposal(null);
    setError(null);
    setAudioTranscript(null);
  }

  if (stage === "review-expense" && proposal) {
    // Build initial prop shaped like ExpenseForm.initial so it preloads.
    const totalPaise = BigInt(proposal.amountPaise);
    const participants = proposal.participants.length
      ? proposal.participants
      : members.map((m) => m.id);

    let shares: Array<{ userId: string; sharePaise: string }>;
    if (proposal.splitMode === "EQUAL") {
      const n = BigInt(participants.length);
      const base = totalPaise / n;
      const rem = totalPaise - base * n;
      shares = participants.map((id, i) => ({
        userId: id,
        sharePaise: (base + (BigInt(i) < rem ? 1n : 0n)).toString()
      }));
    } else if (proposal.splitMode === "AMOUNT") {
      shares = (proposal.customShares ?? []).map((c) => ({
        userId: c.userId,
        sharePaise: String(c.value)
      }));
    } else {
      // PERCENT: value is basis points
      shares = (proposal.customShares ?? []).map((c) => ({
        userId: c.userId,
        sharePaise: ((totalPaise * BigInt(c.value)) / 10000n).toString()
      }));
    }

    return (
      <div className="space-y-4">
        <Card className="bg-muted/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center justify-between">
              <span>Parsed (confidence: {proposal.confidence})</span>
              <Button variant="ghost" size="sm" onClick={reset}>
                Start over
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs space-y-1">
            <p className="italic text-muted-foreground">&ldquo;{transcript}&rdquo;</p>
            {proposal.notes && <p>Note: {proposal.notes}</p>}
          </CardContent>
        </Card>

        <ExpenseForm
          groupId={groupId}
          members={members}
          currentUserId={currentUserId}
          initial={{
            id: "__audio_draft__",
            description: proposal.description,
            amountPaise: String(proposal.amountPaise),
            date: new Date().toISOString(),
            payerId: proposal.payerId ?? currentUserId,
            splitMode: proposal.splitMode,
            shares
          }}
          audioTranscript={audioTranscript ?? undefined}
          createMode
        />
      </div>
    );
  }

  if (stage === "review-transcript") {
    return (
      <div className="space-y-3">
        <div className="space-y-1.5">
          <p className="text-sm font-medium">Transcript</p>
          <Textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            rows={4}
          />
          <p className="text-xs text-muted-foreground">
            Edit before parsing if needed.
          </p>
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={reset}>
            Re-record
          </Button>
          <Button onClick={parse}>Parse expense</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <AudioRecorder onAudioReady={onAudioReady} />
      {stage === "transcribing" && (
        <p className="text-sm text-muted-foreground text-center">Transcribing…</p>
      )}
      {stage === "parsing" && (
        <p className="text-sm text-muted-foreground text-center">Parsing expense…</p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
      <p className="text-xs text-muted-foreground text-center">
        Max 60 seconds. English. Your voice is sent to OpenAI Whisper.
      </p>
    </div>
  );
}
