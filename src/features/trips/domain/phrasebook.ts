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

// A BCP-47 tag for the browser's speech synthesiser, from the language the AI
// named in English.
//
// `language_english` has been on the schema since the feature was built, with a
// comment saying it was "useful for a text-to-speech voice ... later". This is
// later. The AI is asked for a plain English language name, so this is a lookup
// and not a parse.
//
// Why a table and not a library: the whole input space is "languages a trip
// might be to", the answer is two to five characters long, and every mapping
// here is one somebody can check by reading it. A dependency for this would be
// more code to audit than the table.
//
// Regional tags where the choice matters for pronunciation rather than for
// politics — pt-BR and pt-PT are different enough that a Brazilian voice reading
// Lisbon Portuguese is the wrong answer, and "Portuguese" alone most often means
// Brazil to a traveller from Israel. Where it does not matter, the bare language
// tag lets the device pick whatever voice it has.
const SPEECH_LANGS: Record<string, string> = {
  japanese: "ja-JP",
  korean: "ko-KR",
  chinese: "zh-CN",
  mandarin: "zh-CN",
  cantonese: "zh-HK",
  thai: "th-TH",
  vietnamese: "vi-VN",
  hindi: "hi-IN",
  indonesian: "id-ID",
  malay: "ms-MY",
  turkish: "tr-TR",
  arabic: "ar-SA",
  hebrew: "he-IL",
  greek: "el-GR",
  italian: "it-IT",
  spanish: "es-ES",
  portuguese: "pt-BR",
  french: "fr-FR",
  german: "de-DE",
  dutch: "nl-NL",
  english: "en-GB",
  russian: "ru-RU",
  ukrainian: "uk-UA",
  polish: "pl-PL",
  czech: "cs-CZ",
  slovak: "sk-SK",
  hungarian: "hu-HU",
  romanian: "ro-RO",
  bulgarian: "bg-BG",
  croatian: "hr-HR",
  serbian: "sr-RS",
  slovenian: "sl-SI",
  albanian: "sq-AL",
  swedish: "sv-SE",
  norwegian: "nb-NO",
  danish: "da-DK",
  finnish: "fi-FI",
  icelandic: "is-IS",
  estonian: "et-EE",
  latvian: "lv-LV",
  lithuanian: "lt-LT",
  georgian: "ka-GE",
  armenian: "hy-AM",
  persian: "fa-IR",
  farsi: "fa-IR",
  swahili: "sw-KE",
  afrikaans: "af-ZA",
  catalan: "ca-ES",
  filipino: "fil-PH",
  tagalog: "fil-PH",
  nepali: "ne-NP",
  sinhala: "si-LK",
  burmese: "my-MM",
  khmer: "km-KH",
  lao: "lo-LA",
  mongolian: "mn-MN",
  bengali: "bn-BD",
  urdu: "ur-PK",
  tamil: "ta-IN",
};

// Null when the language is not in the table — the caller offers no speak
// control at all rather than handing the synthesiser a tag it will read in the
// browser's default voice. A Hebrew voice sounding out Japanese is worse than
// silence, because it sounds like the feature works.
export function speechLangFor(languageEnglish: string): string | null {
  const key = languageEnglish.trim().toLowerCase();
  if (key in SPEECH_LANGS) return SPEECH_LANGS[key];

  // "Japanese (Nihongo)", "Brazilian Portuguese" — the AI is asked for a bare
  // name and usually gives one, but a qualifier should not lose the voice.
  for (const [name, tag] of Object.entries(SPEECH_LANGS)) {
    if (key.includes(name)) return tag;
  }
  return null;
}
