// OpenAI client singleton + Whisper / parser wrappers.

import OpenAI from "openai";

let _client: OpenAI | null = null;

export function openai(): OpenAI {
  if (_client) return _client;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");
  _client = new OpenAI({ apiKey });
  return _client;
}

// ---------- Whisper ----------

export async function transcribeAudio(file: File): Promise<string> {
  // OpenAI limits: 25 MB. We further cap audio duration client-side.
  const res = await openai().audio.transcriptions.create({
    file,
    model: "whisper-1",
    response_format: "text",
    language: "en"
  });
  // When response_format: "text", `res` is a string.
  return typeof res === "string" ? res : (res as { text?: string }).text ?? "";
}

// ---------- Expense parser ----------

export type ParsedMember = { id: string; name: string; email: string };

export type ParsedExpense = {
  description: string;
  amountPaise: number; // int paise
  payerId: string | null;
  splitMode: "EQUAL" | "AMOUNT" | "PERCENT";
  participants: string[]; // member ids
  customShares?: Array<{ userId: string; value: number }> | null;
  confidence: "high" | "medium" | "low";
  notes?: string;
};

const SYSTEM_PROMPT = `You convert casual English speech (Indian context) about a
shared expense into structured JSON via the provided tool.

Rules:
- Currency is always INR. A number like "500" means ₹500 = 50000 paise.
- Always emit amounts in integer PAISE (₹1 = 100 paise).
- Only use the member ids from the "members" input. Never invent ids.
- If payer is ambiguous or unstated, set payerId = null.
- If split is unstated, default to EQUAL across all provided members.
- AMOUNT mode: customShares.value is paise.
- PERCENT mode: customShares.value is basis points (100% = 10000).
- participants must be a non-empty subset of member ids.
- Set confidence: "high" if payer + total + split are all clearly stated;
  "medium" if some inference was needed; "low" if something material is guessed.
- Include a short "notes" field when confidence != "high".`;

const expenseTool = {
  type: "function" as const,
  function: {
    name: "submit_expense",
    description: "Emit a structured expense parsed from the user's speech.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        description: { type: "string" },
        amountPaise: { type: "integer", minimum: 1 },
        payerId: { type: ["string", "null"] },
        splitMode: { type: "string", enum: ["EQUAL", "AMOUNT", "PERCENT"] },
        participants: {
          type: "array",
          items: { type: "string" },
          minItems: 1
        },
        customShares: {
          type: ["array", "null"],
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              userId: { type: "string" },
              value: { type: "integer", minimum: 0 }
            },
            required: ["userId", "value"]
          }
        },
        confidence: { type: "string", enum: ["high", "medium", "low"] },
        notes: { type: "string" }
      },
      required: [
        "description",
        "amountPaise",
        "payerId",
        "splitMode",
        "participants",
        "confidence"
      ]
    }
  }
};

export async function parseExpense(
  transcript: string,
  members: ParsedMember[],
  currentUserId: string
): Promise<ParsedExpense> {
  const memberList = members
    .map((m) => `- id=${m.id} name="${m.name || m.email}" email=${m.email}`)
    .join("\n");

  const userMsg = [
    `Group members:\n${memberList}`,
    `The speaker's own id is "${currentUserId}" — "I paid", "me", etc. refer to this id.`,
    `Transcript:\n"""${transcript}"""`,
    `Call the submit_expense tool exactly once.`
  ].join("\n\n");

  const completion = await openai().chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userMsg }
    ],
    tools: [expenseTool],
    tool_choice: {
      type: "function",
      function: { name: "submit_expense" }
    }
  });

  const call = completion.choices[0]?.message?.tool_calls?.[0];
  if (!call || call.function.name !== "submit_expense") {
    throw new Error("parser did not call submit_expense");
  }

  let parsed: ParsedExpense;
  try {
    parsed = JSON.parse(call.function.arguments) as ParsedExpense;
  } catch (e) {
    throw new Error("parser returned invalid JSON");
  }

  // Defensive: drop any participant ids that aren't members.
  const validIds = new Set(members.map((m) => m.id));
  parsed.participants = parsed.participants.filter((p) => validIds.has(p));
  if (parsed.payerId && !validIds.has(parsed.payerId)) parsed.payerId = null;
  if (parsed.customShares) {
    parsed.customShares = parsed.customShares.filter((c) =>
      validIds.has(c.userId)
    );
  }

  return parsed;
}
