# AGENTS.md — AI Coding Agents 共通運用規約 (Shared Operating Standard)

このリポジトリ (`rkymgs310-cmyk/Cloude`) において作業するすべての AI コーディングエージェント
（ChatGPT, Claude Code, Gemini / Antigravity, その他）および開発者が遵守すべき恒久的な共通運用ルールです。

## 1. 3大ドキュメントの役割分担 (Document Roles)

リポジトリ内の状態やルールの重複を防ぐため、以下の役割分担を厳守してください。

- **`AGENTS.md` (本書)**: 全 AI 共通の**恒久的な運用規約・プロトコル・規準**（セッション固有の動的タスク状況は書かない）。
- **`docs/AI_CONTEXT.md`**: 現在の**案件ステータス・最新検証結果・Human Gate・次期アクション・Riku OS Writeback層**（セッション終了時に必ず更新）。
- **`README.md`**: **人間向け**のプロジェクト概要・ローカル実行手順・実運用手続きガイド。

---

## 2. 基本運用ループ: READ → PLAN → EXECUTE → VERIFY → WRITEBACK → NEXT

すべてのエージェントは以下の 6 ステップを順に実行してください。

```
READ ──> PLAN ──> EXECUTE ──> VERIFY ──> WRITEBACK ──> NEXT
```

### ① READ（現状把握）
- `AGENTS.md`, `README.md`, `docs/AI_CONTEXT.md` を精読する。
- `git status`, `git branch`, 直近の `git log` を確認し、現在の作業ブランチと変更履歴を把握する。
- 既存のテストスイートおよびビルドが正常に通るか確認する。

### ② PLAN（計画立案）
- ユーザーの指示と現在の `docs/AI_CONTEXT.md` の状態を照合し、最小かつ安全な変更計画を立てる。
- 変更対象のファイルと、検証に必要なテスト・ビルドコマンドを事前に特定する。
- 作業が外部依存（Human Gate）に抵触するかどうかを判定する。

### ③ EXECUTE（安全な実行）
- 計画に基づき、コードや設定ファイルを変更・作成する。
- 既存のコード品質、命名規則、無関係なコメント・Docstring を尊重・維持する。
- 変更はアトミックかつ最小限にとどめ、過剰なリファクタリングや不必要な依存関係の追加を避ける。

### ④ VERIFY（実機検証）
- **必ず実コマンドを実行して検証する**（テスト・ビルドの省略や想像での成功判定は禁止）。
  - `npm test`: 単体テストスイートの全件パスを確認。
  - `npm run build`: 静的ビルドおよびルーティング生成がエラーなく完了することを確認。
- 必要に応じて生成物（`dist/` 以下のファイルや OGP、robots.txt 等）を直接検証する。

### ⑤ WRITEBACK（引き継ぎ層の更新）
- 作業完了後、`docs/AI_CONTEXT.md` を更新する。
  - 今回の検証結果（テスト結果・ビルド結果）
  - 変更内容および設計判断（Decision）
  - 現在のブロッカー状況（Human Gate の更新）
  - 末尾の「Riku OS Writeback Package」を最新状態に反映

### ⑥ NEXT（次アクションの明示）
- 次のセッションを担当する AI または人間が直ちに着手できるよう、優先度順の具体的な「Next actions」を明記する。

---

## 3. コア運用原則 (Core Operating Principles)

### 3.1 Git ブランチの完全分離 (Git Branch Isolation)
- **main/master ブランチへの直接 commit / push は厳禁**。
- 他のエージェントのブランチ（例: Claude セッション中に `gemini/*` ブランチ、Gemini セッション中に `claude/*` ブランチ）を勝手に上書き・push してはならない。
- 必ず現在割り当てられている自己のエージェントブランチ（例: `gemini/...`, `claude/...`）でのみ作業・commit を行い、push 先も該当ブランチのみに限定する (`git push origin HEAD:<current-branch>`)。

### 3.2 Human Gate と安全な自律前進 (Human Gates & Safe Autonomous Continuation)
- **Human Gate の定義**:
  - 外部課金・有料 API キーの発行・支払い情報登録
  - ドメイン取得・DNS 設定・外部ホスティング/ASP/広告契約
  - 2要素認証 (2FA) や本人確認が必要な外部手続き
- **運用原則**:
  - Human Gate が未解消であっても、**プロジェクト全体の作業を停止してはならない**。
  - Human Gate は `docs/AI_CONTEXT.md` のブロッカー一覧に明確に切り出して記録し、**それ以外の安全な前進（テスト自動化、コード堅牢化、SEO改善、CI構築、ドキュメント整備等）を自律的に継続する**。

### 3.3 偽の実行の禁止 (No Fake Execution / Zero Hallucination)
- 「テストを実行してすべてパスしました」「ビルドが成功しました」といった虚偽の報告を絶対に行わない。
- 必ずターミナルツールで実コマンドを実行し、終了コード (exit code 0) およびログ出力を確認する。
- API キーが存在しない場合など、外部 API 呼び出しが不可能な場合は、偽装レスポンスで API 呼び出しを成功したと見せかけず、「モック/単体テストにより純粋関数を検証した」「実 API 呼び出しは未実行」と事実を正確に記録する。

### 3.4 シークレット管理とセキュリティ規律 (Secrets & Security Hygiene)
- API キー、OAuth トークン、秘密鍵、個人認証情報をコード内にハードコードしたり、Git リポジトリにコミットしたりしない。
- `.env` などの機密ファイルは `.gitignore` に含まれていることを確認し、環境変数の雛形は `.env.example` のみで管理する。
- commit 前に必ず `git status` および `git diff --staged` で意図しないファイルや機密情報が含まれていないか目視確認する。

### 3.5 コミット前のテスト・ビルド必須化 (Testing & Build Verification Before Commit)
- コミットを作成する前に、必ず以下を実行して正常終了を確認する:
  1. `npm test`（単体テスト全件パス）
  2. `npm run build`（Astro プロダクションビルド成功）
- テストやビルドが失敗している状態でのコミット・push は禁止。

### 3.6 Cross-AI Handoff プロトコル (Cross-AI Handoff Protocol)
- どの AI（ChatGPT, Claude, Gemini, 他）が次にリポジトリを開いても、過去のチャットログやモデル固有のメモリなしに 100% 状況を把握・再開できるようにする。
- そのための唯一の真実の引き継ぎ層が `docs/AI_CONTEXT.md` である。
- 「自分しか知らないコンテキスト」をローカルの頭の中だけに留めず、必ず `docs/AI_CONTEXT.md` に書き戻すこと。

### 3.7 Riku OS Writeback 規律 (Riku OS Writeback Standard)
- `docs/AI_CONTEXT.md` 末尾の「Riku OS Writeback Package」は、Riku AI OS Master スプレッドシート（意思決定・進捗管理の正本）へ直接貼り付けて反映できるように標準フォーマットを保つ。
  - `PROJECT_REGISTRY_UPDATE`: プロジェクト台帳用の 1 行 markdown 表
  - `PROGRESS_UPDATE`: 進捗・決定事項・変更ファイル・ブロッカーの要約
  - `DECISION_UPDATE`: セッション内で行った重要なアーキテクチャ・運用判断の理由
  - `BLOCKER`: 解決に必要なアクションと担当者（Human Gate 等）
