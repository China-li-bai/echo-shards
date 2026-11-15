import type { Metadata } from "next";
import { SpeakDesk } from "@/components/speak-desk";

export const metadata: Metadata = {
  title: "练自我介绍",
};

export default function SpeakPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10 sm:px-6">
      <div className="max-w-2xl">
        <p className="text-sm font-medium tracking-[0.16em] text-primary uppercase">开口</p>
        <h1 className="font-display mt-2 text-4xl sm:text-5xl">自我介绍</h1>
        <p className="mt-3 text-muted-foreground">
          一句太长时，先说一小段。听示范，再听你自己，需要就再听一遍。
        </p>
      </div>
      <SpeakDesk />
    </div>
  );
}
