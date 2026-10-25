/**
 * 语音 Provider 接口占位 — 本阶段不实现。
 * 下一阶段接 ASR/TTS/发音评分时，实现下列接口并注入对话管线即可。
 * 禁止在本阶段依赖真实语音 SDK。
 */

/** @deprecated 本阶段不实现 */
export interface AsrProvider {
  /** 音频 → 文本转写 */
  transcribe(_audio: Uint8Array, _opts?: { lang?: string }): Promise<{ text: string }>;
}

/** @deprecated 本阶段不实现 */
export interface TtsProvider {
  /** 文本 → 音频（返回 URL 或字节） */
  synthesize(_text: string, _opts?: { voice?: string }): Promise<{ audioUrl?: string; bytes?: Uint8Array }>;
}

/** @deprecated 本阶段不实现 */
export interface PronunciationProvider {
  /** 目标句 vs 学习者产出 → 分数 */
  score(
    _reference: string,
    _hypothesis: string,
    _opts?: { audio?: Uint8Array },
  ): Promise<{ score: number; details?: Record<string, unknown> }>;
}

export type VoiceProviderBundle = {
  asr?: AsrProvider;
  tts?: TtsProvider;
  pronunciation?: PronunciationProvider;
};

/** 文字阶段：空实现占位，调用即抛错，防止误用 */
export const NoVoiceProviders: VoiceProviderBundle = {};

export function assertNoVoiceInTextPhase(): void {
  // 文档锚点：文字先行阶段不得注入语音 Provider
}
