"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { chunkSelfIntro, matchSpokenWords, type SpeechChunk, type SpokenWordMatch } from "@echo-shards/core";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { loadSpeakTakes, saveSpeakTake } from "@/lib/speak-audio";

const SCRIPT_KEY = "echo-shards.speak.v1";

const STARTER =
  "I am a software engineer. I like turning a vague problem into one small step a person can finish today. In a recent project I helped a team practice English with short, clear tasks. I want this role because I can write carefully and follow through.";

type Mark = "smooth" | "stuck";

interface SavedScript {
  version: 1;
  text: string;
  marks: Record<string, Mark>;
}

function hashText(text: string): string {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

export function SpeakDesk() {
  const [text, setText] = useState(STARTER);
  const [ready, setReady] = useState(false);
  const [active, setActive] = useState(0);
  const [marks, setMarks] = useState<Record<string, Mark>>({});
  const [recording, setRecording] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [takes, setTakes] = useState<Record<number, string>>({});
  const [checks, setChecks] = useState<Record<number, { status: "loading" | "ready" | "failed"; match?: SpokenWordMatch }>>({});
  const [dictionary, setDictionary] = useState<Record<number, string>>({});
  const recorder = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const urls = useRef<string[]>([]);

  const pieces = useMemo(() => chunkSelfIntro(text), [text]);
  const scriptHash = useMemo(() => hashText(text.trim()), [text]);
  const current = pieces[active] ?? pieces[0];

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SCRIPT_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as SavedScript;
      if (saved.version === 1 && typeof saved.text === "string" && saved.text.trim()) {
        setText(saved.text);
        setMarks(saved.marks ?? {});
      }
    } catch {
      setStatus("这台设备上的稿子这次读不了。稿子还在，没有删掉。");
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    const saved: SavedScript = { version: 1, text, marks };
    try {
      localStorage.setItem(SCRIPT_KEY, JSON.stringify(saved));
    } catch {
      setStatus("稿子这次没存下来。文字还在页面上。");
    }
  }, [ready, text, marks]);

  useEffect(() => {
    let cancel = false;
    for (const url of urls.current) URL.revokeObjectURL(url);
    urls.current = [];
    setTakes({});
    loadSpeakTakes(scriptHash)
      .then((rows) => {
        if (cancel) return;
        const next: Record<number, string> = {};
        for (const row of rows) {
          const url = URL.createObjectURL(row.blob);
          urls.current.push(url);
          next[row.chunkIndex] = url;
        }
        setTakes(next);
      })
      .catch(() => {
        if (!cancel) setStatus("录音这次读不了。可以再录一次。");
      });
    return () => {
      cancel = true;
    };
  }, [scriptHash]);

  async function speakReference(chunk: SpeechChunk) {
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    setStatus("正在准备示范声音。第一次会下载模型，文字不会上传。");
    try {
      const { playKokoroReference } = await import("@/lib/speak-reference");
      await playKokoroReference(chunk.text);
      setStatus("正在放这一小段的示范。这不是你的声音，也不算分。");
      return;
    } catch {
      /* The model download can fail. The system voice still reads the line. */
    }
    if (typeof window === "undefined" || !window.speechSynthesis) {
      setStatus("这台设备现在放不出示范声音。你可以先录音，再听自己。");
      return;
    }
    const utter = new SpeechSynthesisUtterance(chunk.text);
    utter.lang = "en-US";
    utter.rate = 0.9;
    window.speechSynthesis.speak(utter);
    setStatus("示范模型这次没装上，先放系统声音。这不是你的声音，也不算分。");
  }

  async function startRecording(chunk: SpeechChunk) {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("这台设备没有可用的麦克风。");
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setStatus("这次没有打开麦克风。可以再试一次。");
      return;
    }
    const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : undefined;
    const media = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    chunksRef.current = [];
    media.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    media.onstop = () => {
      for (const track of stream.getTracks()) track.stop();
      const blob = new Blob(chunksRef.current, { type: media.mimeType || "audio/webm" });
      const url = URL.createObjectURL(blob);
      urls.current.push(url);
      setTakes((prev) => ({ ...prev, [chunk.index]: url }));
      setRecording(false);
      setStatus("录好了。可以听我自己，也可以再录一次。");
      saveSpeakTake({ scriptHash, chunkIndex: chunk.index, blob }).catch(() => {
        setStatus("这段录音还在这一页上，这次没存进设备。刷新后可能不在。");
      });
    };
    recorder.current = media;
    media.start();
    setRecording(true);
    setStatus("正在录。说完这一小段再停。");
    window.setTimeout(() => {
      if (recorder.current === media && media.state === "recording") media.stop();
    }, 60_000);
  }

  function stopRecording() {
    const media = recorder.current;
    if (media && media.state === "recording") media.stop();
  }

  function playMine(index: number) {
    const url = takes[index];
    if (!url) {
      setStatus("这一小段还没有你的录音。");
      return;
    }
    const audio = new Audio(url);
    void audio.play();
    setStatus("正在放你自己的声音。");
  }

  async function playAllMine() {
    const ordered = pieces.filter((piece) => takes[piece.index]);
    if (ordered.length === 0) {
      setStatus("还没有录音。先录一小段。");
      return;
    }
    for (const piece of ordered) {
      const url = takes[piece.index];
      if (!url) continue;
      await new Promise<void>((resolve) => {
        const audio = new Audio(url);
        audio.onended = () => resolve();
        audio.onerror = () => resolve();
        void audio.play().catch(() => resolve());
      });
    }
    setStatus("你录过的小段都放完了。");
  }

  function mark(chunk: SpeechChunk, value: Mark) {
    setMarks((prev) => ({ ...prev, [String(chunk.index)]: value }));
  }

  async function checkWords(chunk: SpeechChunk) {
    const url = takes[chunk.index];
    if (!url) {
      setStatus("这一小段还没有你的录音。");
      return;
    }
    setChecks((prev) => ({ ...prev, [chunk.index]: { status: "loading" } }));
    setStatus("正在这台设备上听写。第一次会下载一个小模型，录音不会上传。");
    try {
      const blob = await fetch(url).then((response) => response.blob());
      const { transcribeSpeakBlob } = await import("@/lib/transcribe-speak");
      const transcript = await transcribeSpeakBlob(blob);
      const match = matchSpokenWords(chunk.text, transcript);
      setChecks((prev) => ({ ...prev, [chunk.index]: { status: "ready", match } }));
      setStatus(
        match.missing.length === 0
          ? "这一小段的词都出现在听写里。不是发音对了。"
          : "有的词还没听到。可以再听自己，再录一次。",
      );
    } catch {
      setChecks((prev) => ({ ...prev, [chunk.index]: { status: "failed" } }));
      setStatus("这次没能在这台设备上听写。录音还在，可以再听自己。没有把任何分数记下来。");
    }
  }

  async function showDictionary(chunk: SpeechChunk) {
    setStatus("正在查这一小段的词典读音。");
    try {
      const { dictionaryPronunciation } = await import("@/lib/dictionary-pronunciation");
      const phones = await dictionaryPronunciation(chunk.text);
      if (!phones) throw new Error("empty pronunciation");
      setDictionary((prev) => ({ ...prev, [chunk.index]: phones }));
      setStatus("这是词典读音，是练习提示，不是你刚才读得对不对。");
    } catch {
      setStatus("这次没有拿到词典读音。可以继续听示范和听自己。没有记分。");
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-3xl">练一段自我介绍</CardTitle>
          <CardDescription>
            先把长句分成小段。听这一小段，再听你自己。录完可以看看词有没有说到。词对上了，也不会判断你的发音对不对，也不会改下次该练哪个词。
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <label htmlFor="script" className="text-sm font-medium">
            你的英文稿
          </label>
          <Textarea
            id="script"
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              setActive(0);
            }}
            rows={6}
          />
          <p className="text-sm text-muted-foreground">这段练习稿可以整段换成你自己的话。</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => setActive(0)}>
              分成小段
            </Button>
            <Button type="button" variant="outline" onClick={() => void playAllMine()}>
              按顺序再听我的录音
            </Button>
          </div>
          {status ? <p className="text-sm text-muted-foreground">{status}</p> : null}
        </CardContent>
      </Card>

      {pieces.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-2xl">先写一句英文</CardTitle>
            <CardDescription>写上你要说的自我介绍，再分成小段。</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {pieces.map((piece) => {
            const selected = current?.index === piece.index;
            const mine = Boolean(takes[piece.index]);
            const note = marks[String(piece.index)];
            return (
              <Card key={piece.index} className={selected ? "border-primary/40" : undefined}>
                <CardHeader>
                  <CardTitle className="text-base">
                    第 {piece.index + 1} 小段 · {piece.words} 个词
                  </CardTitle>
                  <CardDescription className="text-base text-foreground">{piece.text}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" onClick={() => speakReference(piece)}>
                      听这一小段
                    </Button>
                    {recording && selected ? (
                      <Button type="button" onClick={stopRecording}>
                        停
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        onClick={() => {
                          setActive(piece.index);
                          void startRecording(piece);
                        }}
                      >
                        录下来
                      </Button>
                    )}
                    <Button type="button" variant="outline" disabled={!mine} onClick={() => playMine(piece.index)}>
                      听我自己
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!mine || checks[piece.index]?.status === "loading"}
                      onClick={() => void checkWords(piece)}
                    >
                      看看词说全了没有
                    </Button>
                    <Button type="button" variant="outline" onClick={() => void showDictionary(piece)}>
                      看看词典怎么读
                    </Button>
                  </div>
                  {checks[piece.index]?.status === "ready" && checks[piece.index]?.match ? (
                    <div className="text-sm leading-relaxed">
                      <p>听到了：{checks[piece.index]?.match?.heard.join("、") || "没有"}</p>
                      <p>还没听到：{checks[piece.index]?.match?.missing.join("、") || "没有"}</p>
                      <p className="text-muted-foreground">这只说明听写里有这些词。不是发音对了，也不会改下次该练哪个词。</p>
                    </div>
                  ) : null}
                  {dictionary[piece.index] ? (
                    <p className="text-sm leading-relaxed">
                      词典里大概读成：{dictionary[piece.index]}
                      <span className="mt-1 block text-muted-foreground">
                        这是练习提示，不是考官评分，也不会改下次该练哪个词。
                      </span>
                    </p>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant={note === "smooth" ? "default" : "outline"} onClick={() => mark(piece, "smooth")}>
                      这小段顺了
                    </Button>
                    <Button type="button" variant={note === "stuck" ? "default" : "outline"} onClick={() => mark(piece, "stuck")}>
                      这小段还卡
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">这是你听完自己的选择，不是发音分数。</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
