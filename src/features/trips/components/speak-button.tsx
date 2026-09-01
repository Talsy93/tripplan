"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/cn";

// Says the phrase out loud, in the destination's own language.
//
// The phrasebook already drew a `Volume2` beside every pronunciation line and it
// did nothing — it was there to label the line, and it was read as a play button,
// which is a fair reading of a speaker icon. This is the button that icon looked
// like.
//
// The browser's own speech synthesiser, which costs nothing and sends nothing
// anywhere: `speechSynthesis` is part of the platform, the voices are installed
// on the device, and no text leaves it. Under the project's no-paid-services
// rule that is not a compromise — a cloud TTS would be a per-character bill for
// a worse privacy story.
//
// Three states, and the third is the one that matters:
//
//   ready       a voice for this language is installed. Press to hear it.
//   speaking    pressed. Press again to stop.
//   unavailable no voice for this language on this device. The button says so
//               and is disabled, rather than reading Japanese in a Hebrew voice
//               — which sounds like the feature works and teaches the wrong
//               pronunciation.

// The installed voices are an external store, and reading them has two quirks
// that make it exactly the case useSyncExternalStore exists for:
//
//   * Chrome returns an empty array from the first getVoices() and fills it
//     later, announcing that with `voiceschanged`. So "empty" means "not yet",
//     not "none" — treating them the same disables every button on a cold load.
//   * Safari and Firefox return the full list synchronously, so the value on the
//     client's first render differs from the server's. An effect setting state
//     for this trips the cascading-render lint rule; a value read during render
//     hydrates with a mismatch. useSyncExternalStore is handed both problems by
//     design: it hydrates from the server snapshot and swaps in the client's
//     without a warning.
//
// The snapshot is a string rather than the VoiceInfo array because it is compared
// by identity: getVoices() returns a fresh array every call, which would re-render
// forever.
const UNSUPPORTED = "\0unsupported";

function hasSynthesis(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

function subscribeVoices(onChange: () => void) {
  if (!hasSynthesis()) return () => {};
  window.speechSynthesis.addEventListener("voiceschanged", onChange);
  return () => {
    window.speechSynthesis.removeEventListener("voiceschanged", onChange);
  };
}

function voiceSnapshot(): string {
  if (!hasSynthesis()) return UNSUPPORTED;
  // Sorted, so a browser that reorders the list without adding to it does not
  // read as a change.
  return window.speechSynthesis
    .getVoices()
    .map((voice) => voice.lang)
    .sort()
    .join(",");
}

// Empty is "still loading", which is what the server has to claim too.
const serverSnapshot = () => "";

export function SpeakButton({
  text,
  // A BCP-47 tag — see speechLangFor() in domain/phrasebook.ts.
  lang,
  label,
}: {
  text: string;
  lang: string;
  label: string;
}) {
  const langs = useSyncExternalStore(
    subscribeVoices,
    voiceSnapshot,
    serverSnapshot,
  );
  const [speaking, setSpeaking] = useState(false);

  const base = lang.split("-")[0];
  // Optimistic while the list is empty: a button that is briefly enabled and
  // then turns out to have no voice is a better first frame than one that is
  // disabled on every cold load and enables itself a moment later.
  const unavailable =
    langs === UNSUPPORTED ||
    (langs !== "" &&
      !langs.split(",").some((tag) => tag.split("-")[0] === base));

  // Anything still being spoken when this unmounts — a filter typed into the
  // phrasebook removes cards mid-sentence — is cancelled. speechSynthesis is a
  // single global queue, so a card that goes away without doing this leaves the
  // browser talking about a phrase that is no longer on screen.
  useEffect(() => {
    return () => {
      if (hasSynthesis()) window.speechSynthesis.cancel();
    };
  }, []);

  function speak() {
    if (!hasSynthesis()) return;

    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }

    // Cancel first: the queue is global, so pressing a second card while the
    // first is talking should replace it rather than line up behind it.
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    const voice = window.speechSynthesis
      .getVoices()
      .find((candidate) => candidate.lang.split("-")[0] === base);
    if (voice) utterance.voice = voice;
    // A shade under conversational. A phrase you are about to repeat is one you
    // need to hear the syllables of, and the default rate is tuned for reading
    // paragraphs rather than for teaching a word.
    utterance.rate = 0.9;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);

    setSpeaking(true);
    window.speechSynthesis.speak(utterance);
  }

  return (
    <button
      type="button"
      onClick={speak}
      disabled={unavailable}
      aria-label={
        unavailable ? `אין קול מותקן לשפה הזו במכשיר — ${label}` : label
      }
      title={
        unavailable
          ? "במכשיר הזה לא מותקן קול לשפת היעד"
          : speaking
            ? "עצירה"
            : label
      }
      className={cn(
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors duration-press",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        unavailable
          ? "cursor-not-allowed text-border-strong"
          : speaking
            ? // Lit while it is talking, so a row of cards makes it obvious
              // which one you are hearing.
              "bg-primary text-white"
            : "bg-primary-tint text-primary-ink hover:bg-primary hover:text-white",
      )}
    >
      {unavailable ? (
        <VolumeX className="h-4 w-4" aria-hidden="true" />
      ) : (
        <Volume2
          className={cn("h-4 w-4", speaking && "animate-pulse")}
          aria-hidden="true"
        />
      )}
    </button>
  );
}
