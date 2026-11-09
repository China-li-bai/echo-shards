# Enrichment 审校管线（文字先行）

目标：给 NGSL-S pending lemmas 补 `gloss_zh` / `phonetic_text` / 例句，**禁止编造**。

批次、发布版本与「模型不得 merge」见 [evolution-architecture.md](evolution-architecture.md) 第 4 节。命令本身没有变。

## 命令

```bash
npm run enrichment:validate   # 形状 + pending 空 gloss 政策；违规非 0
npm run enrichment:queue      # 写出 content/lexemes/enrichment-queue.json（仅上游英义）
npm run enrichment:merge -- --from path/to/reviewed.json
```

## 流程

1. `enrichment:queue` 列出下一批评审行：`status=needs_review`，`gloss_zh=""`。
2. 人工编辑器填写 `gloss_zh`、`phonetic_text`、`example_sentence`（可改 `status` 为 `reviewed`）。
3. `enrichment:merge --from <reviewed>` 合并进 `enrichment-top50-zh.json`，再跑 `import:ngsl-s` + `enrichment:validate`。
4. 网页 `/enrichment` 只读展示队列与合并说明。

## 硬规则

- pending catalog 行必须空 `gloss_zh`（UI 显示「待审校」）。
- merge 拒绝缺字段的行，不会用模型填中文义。
- 语音 ASR/TTS 不在本管线。
