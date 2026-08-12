import { GoogleGenAI } from "@google/genai";
import * as z from "zod";

// Provider-agnostic entry point for structured generation. The rest of the app
// depends only on this function; swapping Gemini for another provider means
// changing this file alone.
//
// A single Zod schema does double duty: it constrains the model's output
// (converted to JSON Schema) and validates the response.

// `-latest` alias tracks the current Flash model, so the code survives a
// specific version being retired (as gemini-2.5-flash was for new users).
const MODEL = "gemini-flash-latest";

// A turn in a conversation. "model" rather than "assistant" because that is
// what Gemini calls it; the name stops here — nothing outside this file needs
// to know whose vocabulary it is.
export type ChatMessage = { role: "user" | "model"; text: string };

// Multi-turn plain-text generation, for the trip chat.
//
// Separate from generateStructured rather than an option on it: one returns
// prose to a person, the other returns a validated object to the database, and
// collapsing them would mean a function whose return type depends on a flag.
export async function generateText(params: {
  messages: ChatMessage[];
  systemInstruction?: string;
}): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: params.messages.map((message) => ({
      role: message.role,
      parts: [{ text: message.text }],
    })),
    config: params.systemInstruction
      ? { systemInstruction: params.systemInstruction }
      : undefined,
  });

  const text = response.text;
  if (!text) {
    throw new Error("Empty response from AI provider");
  }
  return text;
}

export async function generateStructured<T>(params: {
  prompt: string;
  schema: z.ZodType<T>;
}): Promise<T> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const jsonSchema = z.toJSONSchema(params.schema) as Record<string, unknown>;
  // Gemini's responseJsonSchema does not accept the top-level $schema key.
  delete jsonSchema["$schema"];

  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: params.prompt,
    config: {
      responseMimeType: "application/json",
      responseJsonSchema: jsonSchema,
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error("Empty response from AI provider");
  }

  return params.schema.parse(JSON.parse(text));
}
