"use client";

/**
 * PR8 演示卫生控件：放在页脚演示区，非主路径 CTA。
 * 确认后清 `echo-shards.*` 练习痕迹并整页回到营地冷启态。
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  CLEAR_PRACTICE_BUTTON_LABEL,
  CLEAR_PRACTICE_CONFIRM,
  CLEAR_PRACTICE_HELP,
  clearPracticeRecords,
} from "@/lib/clear-practice-local";

export function ClearPracticeRecords() {
  const [busy, setBusy] = useState(false);

  function onClear() {
    if (typeof window === "undefined" || typeof localStorage === "undefined") return;
    // 合签确认：必须点「确定」才清，防误触
    if (!window.confirm(CLEAR_PRACTICE_CONFIRM)) return;
    setBusy(true);
    try {
      clearPracticeRecords(localStorage);
    } finally {
      // 整页刷新，使顶栏灰态 / 营地账本 / 潮汐壳回到首日冷启动态
      window.location.assign("/");
    }
  }

  return (
    <div className="space-y-2">
      <p className="leading-relaxed text-muted-foreground">{CLEAR_PRACTICE_HELP}</p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={onClear}
        className="text-muted-foreground"
      >
        {CLEAR_PRACTICE_BUTTON_LABEL}
      </Button>
    </div>
  );
}
