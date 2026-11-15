/**
 * Reference voice for one self-intro chunk.
 * Kokoro runs in the browser after the learner asks to hear the line.
 * Failure is thrown so the page can use the system voice instead.
 * This module does not schedule and does not read secrets.
 */

export const SPEAK_TTS_MODEL = "onnx-community/Kokoro-82M-v1.0-ONNX";
export const SPEAK_TTS_VOICE = "af_heart";

type KokoroVoice = {
  generate(text: string, options?: { voice?: string; speed?: number }): Promise<{ toBlob(): Blob }>;
};

let loading: Promise<KokoroVoice> | null = null;
let playing: HTMLAudioElement | null = null;

async function loadVoice(): Promise<KokoroVoice> {
  if (!loading) {
    loading = import("kokoro-js")
      .then(({ KokoroTTS }) =>
        KokoroTTS.from_pretrained(SPEAK_TTS_MODEL, {
          dtype: "q8",
          device: "wasm",
        }),
      )
      .then((voice) => voice as KokoroVoice)
      .catch((error: unknown) => {
        loading = null;
        throw error;
      });
  }
  return loading;
}

export async function playKokoroReference(text: string): Promise<void> {
  if (typeof window === "undefined") {
    throw new Error("Reference speech runs in the browser.");
  }
  const voice = await loadVoice();
  const audio = await voice.generate(text, { voice: SPEAK_TTS_VOICE, speed: 0.9 });
  const url = URL.createObjectURL(audio.toBlob());
  if (playing) {
    playing.pause();
    URL.revokeObjectURL(playing.src);
  }
  const player = new Audio(url);
  playing = player;
  player.onended = () => {
    URL.revokeObjectURL(url);
    if (playing === player) playing = null;
  };
  await player.play();
}
