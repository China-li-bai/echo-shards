/**
 * Browser-only transcript of one self-intro recording.
 * The model file downloads in the learner's browser on the first click.
 * This module does not schedule and does not read secrets.
 */

export const SPEAK_ASR_MODEL = "Xenova/whisper-tiny.en";

type Transcriber = (audio: string) => Promise<{ text?: string } | string>;

let loading: Promise<Transcriber> | null = null;

export async function transcribeSpeakBlob(blob: Blob): Promise<string> {
  if (typeof window === "undefined") {
    throw new Error("Speech transcription runs in the browser.");
  }
  if (!loading) {
    loading = import("@huggingface/transformers")
      .then(({ pipeline }) =>
        pipeline("automatic-speech-recognition", SPEAK_ASR_MODEL, {
          device: "wasm",
        }),
      )
      .then((transcriber) => transcriber as Transcriber)
      .catch((error: unknown) => {
        loading = null;
        throw error;
      });
  }
  const transcriber = await loading;
  const url = URL.createObjectURL(blob);
  try {
    const output = await transcriber(url);
    if (typeof output === "string") return output.trim();
    return typeof output?.text === "string" ? output.text.trim() : "";
  } catch (error) {
    loading = null;
    throw error;
  } finally {
    URL.revokeObjectURL(url);
  }
}
