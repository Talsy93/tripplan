import * as z from "zod";

// Useful words and phrases for the trip's destination.
//
// The destination language isn't stored anywhere on a trip — the app knows
// cities, not countries — so the AI is asked to work it out from them and
// report which language it chose. That answer is saved, so a phrasebook always
// says what language it's actually in.

export const aiPhraseSchema = z.object({
  he: z.string(),
  en: z.string(),
  // The phrase in the destination's own script.
  local: z.string(),
  // How to say it, written in Hebrew letters. The point of the whole feature:
  // a Hebrew speaker can't read "ありがとう", so without this the local column
  // is decoration. Equal to `local` when the language already uses an alphabet
  // the reader can sound out.
  pronunciation: z.string(),
});
export type AiPhrase = z.infer<typeof aiPhraseSchema>;

export const aiPhraseSectionSchema = z.object({
  title: z.string(),
  phrases: z.array(aiPhraseSchema),
});
export type AiPhraseSection = z.infer<typeof aiPhraseSectionSchema>;

export const aiPhrasebookSchema = z.object({
  // "יפנית" — for showing the user.
  language: z.string(),
  // "Japanese" — stable across renders and useful for a text-to-speech voice
  // or a dictionary link later.
  language_english: z.string(),
  sections: z.array(aiPhraseSectionSchema),
});
export type AiPhrasebook = z.infer<typeof aiPhrasebookSchema>;

export const phrasebookRequestSchema = z.object({
  tripId: z.uuid(),
});
export type PhrasebookRequest = z.infer<typeof phrasebookRequestSchema>;

// The situations worth covering, in the order a trip actually happens: you
// land, you get around, you eat, you buy things, and occasionally something
// goes wrong. Kept here rather than in the prompt string so the set is
// reviewable as data.
export const PHRASE_TOPICS = [
  "ברכות, נימוס ותודות",
  "התמצאות ותחבורה",
  "מסעדות והזמנת אוכל",
  "קניות ומחירים",
  "לינה ומלון",
  "מצבי חירום ובריאות",
] as const;
