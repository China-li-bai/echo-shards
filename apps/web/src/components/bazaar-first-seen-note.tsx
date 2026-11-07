"use client";

import { useEffect, useState } from "react";
import { hasFirstMeaningSuccess } from "@/lib/learner-practice-local";

/**
 * 市集首见旁注（合签可选）：意思练过一轮后第一次进市集时提示。
 * 未首成功时不展示（顶栏/营地已灰态拦截主推）。
 */
export function BazaarFirstSeenNote() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    setShow(hasFirstMeaningSuccess());
  }, []);

  if (!show) return null;

  return (
    <p className="mt-3 text-sm text-muted-foreground">
      意思练过一轮，可以来市集试试。
    </p>
  );
}
