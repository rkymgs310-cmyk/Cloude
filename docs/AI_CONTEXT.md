# AI_CONTEXT.md — この案件を初めて見るAI/人間向けの状態ファイル

このファイルは Riku AI OS の Handoff層です。ChatGPT / Gemini / 他のcoding agent /
人間が、会話履歴やモデル固有Memoryなしにこのリポジトリの現在地を把握できるようにする
ことが目的です。正本は Google Drive の **Riku OS Master** スプレッドシートですが、
このセッションではそこへ直接書き込む権限/安全な手段がなかったため、反映用データを
末尾の「Riku OS Writeback Package」にそのまま貼り付け可能な形で保持しています。

- **Project ID**: `AFF-GADGET`
- **Canonical GitHub Repository**: `rkymgs310-cmyk/Cloude`
- **Last updated**: 2026-09-20 (Claude session)

## 1. Objective

「ガジェット比較ラボ」— AIツール・スマート家電・ガジェットのニッチ比較/レビューサイト。
Claude APIで記事を自動生成し、AdSense・アフィリエイト(Amazon等)で収益化する副業プロジェクト。
Riku OS全体でのカテゴリは「Content OS / Affiliate / Website」。

## 2. Architecture

- **Astro** (静的サイトジェネレーター) + `@astrojs/sitemap`
- `src/content/posts/*.md` — 記事本体。Content Collections (`src/content/config.ts`) でスキーマ管理
  (title, description, pubDate, keyword, tags, draft)
- `data/topics.json` — 記事化するキーワードのキュー
- `scripts/generate-post.mjs` — キューから1件取り出し、Claude API (`@anthropic-ai/sdk`) で
  記事生成 → バリデーション → `src/content/posts/` へ書き出し → キューを更新
- `.github/workflows/generate-post.yml` — 毎日 21:00 JST の cron + 手動実行(`workflow_dispatch`)
- `src/components/AdSlot.astro` — AdSense未設定時は自動非表示
- `src/components/AffiliateLink.astro` — `href`未設定時は「リンク準備中」表示(空リンク公開防止)
- 各記事ページ (`src/pages/posts/[slug].astro`) は同じタグを持つ記事を最大3件、
  「関連記事」として自動リンク(内部リンク対策、ビルド時計算・キュー変更不要)

## 3. Current deployment state

- ホスティング先: **未接続**。`astro.config.mjs` の `site` はプレースホルダ (`https://example.com`)
- 独自ドメイン: **未取得**
- AdSense: **未申請**(`PUBLIC_ADSENSE_CLIENT_ID`/`PUBLIC_ADSENSE_SLOT_ID` 未設定)
- アフィリエイト(Amazon等): **未契約**。`AffiliateLink` コンポーネントは全て `href` 未設定のプレースホルダ状態
- 記事: 4本公開済み(`smart-plug-guide`, `power-bank-buying-guide`,
  `ai-image-generation-commercial-use`, `best-ai-note-taking-apps-2026`)
- リポジトリのdefault branchは `claude/usage-mastery-5hccig`(過去セッションが作成)。
  `main`ブランチは存在しない

## 4. Automation

- GitHub Actions (`generate-post.yml`) が毎日1本、キューから記事を自動生成・commit・push
- 2026-09-20のセッションで以下を追加:
  - **Preflight check**: `ANTHROPIC_API_KEY` 未設定時は生成をスキップし、
    `$GITHUB_STEP_SUMMARY` に対応手順を明示して**成功扱いで終了**(無意味な毎日赤X通知を防止)
  - **Generator側バリデーション**: タイトル/説明/スラッグ/本文の必須チェック、
    比較表(Markdownテーブル)の有無チェック、本文が極端に短い場合はエラーで停止
  - **スラッグ重複防止**: 生成スラッグが既存記事/キューと衝突する場合は `-2`, `-3` を自動付与
  - **定型AI締め文句の自動除去**(「いかがでしたか」等を含む文を削除)
  - **重複段落検出**(完全一致する段落が2回以上出現した場合、ログに警告を出力。生成は止めない)
  - **キーワード重複検出**(`data/topics.json` 内の重複キーワードを実行時に警告)
  - **優先度対応のキュー選択**(`topics.json` の各エントリに任意で `priority: "high"|"low"` を
    付けられる。未指定は通常優先度として扱われる。既存11件は無変更)

## 5. Current blockers

| 種別 | 内容 | 対応者 | 状態 |
| --- | --- | --- | --- |
| **Human Gate** | `ANTHROPIC_API_KEY` がGitHub Secretsに未登録。9/17〜9/19の3日連続でcronが失敗(2026-09-20のセッションでpreflight化し、以後は失敗ではなくスキップ扱いに変更) | 人間 (課金・API発行が必要なためAIは代行不可) | **未解消** |
| 派生ブロッカー | 上記によりAdSense審査(記事15-20本必要)、独自ドメイン接続、アフィリエイト申請も未着手 | 人間 | 未解消 |

**Human action (変更なし、README記載の手順と同一)**:
1. https://console.anthropic.com でAPIキー発行(支払い方法登録が必要)
2. GitHub → Settings → Secrets and variables → Actions →
   `ANTHROPIC_API_KEY` という名前で登録
3. Actions タブの "Generate daily post" を Run workflow で手動実行して確認

## 6. Canonical sources

- **コード/実行環境の正本**: この GitHub リポジトリ (`rkymgs310-cmyk/Cloude`)
- **プロジェクト管理/意思決定の正本**: Google Drive「Riku OS Master」スプレッドシート
  (Project Registry表: 案件ID/案件名/領域/状態/優先度/次アクション/締切・次の節目/最終更新/更新根拠/メモ)
  — **本プロジェクトの行はまだ存在しない**。本ファイル末尾のWritebackパッケージを
  書き込み権限のあるAI/人間がそのまま反映してください
- **運用原則の正本**: Google Drive「Riku OS｜AI Context Management Standard v0.1」
  (READ→PLAN→EXECUTE→VERIFY→WRITEBACK→NEXT ACTIONループ、Human Gate基準)

## 7. Important files

- `scripts/generate-post.mjs` — 生成ロジック本体(バリデーション含む)
- `data/topics.json` — キーワードキュー
- `.github/workflows/generate-post.yml` — 自動実行フロー
- `src/content/config.ts` — 記事スキーマ
- `src/pages/posts/[slug].astro` — 記事ページ(関連記事ロジック含む)
- `README.md` — 人間が行うべき手続き(ドメイン/AdSense/アフィリエイト等)の詳細手順

## 8. Current queue (data/topics.json)

11キーワード中、既に4件処理済み(`done: true`)。未処理は7件
(スマート家電・ガジェット・AIツールカテゴリ)。スキーマ: `keyword`, `tags`, 任意で
`priority`("high"/"low"、未指定は通常優先度)、生成後は自動付与される `done`, `slug`,
`generatedAt`。過剰設計を避けるため、これ以上のフィールド追加は現時点では不要と判断。

## 9. Latest verification (2026-09-20 session)

- `npm run build` → 成功(8ページ生成、エラーなし)
- 生成ロジックの純粋関数(スラッグ重複解消、優先度ソート、禁止フレーズ除去、比較表検出)を
  ローカルでユニットテスト相当のスクリプトで検証 → 全て合格
  (Anthropic APIキーが無い/課金を避けるため、実際のAPI呼び出しは行っていない)
- GitHub Actions workflow YAML構文を検証 → 有効
- 関連記事(内部リンク)機能をビルド出力で確認 → タグが一致する記事間で正しくリンク生成、
  一致しない記事では非表示になることを確認

## 10. Next actions

優先度順:
1. **(Human Gate)** `ANTHROPIC_API_KEY` をGitHub Secretsに登録 → cron再開
2. **(Human Gate / write権限のあるAI)** 本ファイル末尾のWritebackパッケージを
   Riku OS Master の Project Registry / Progress Log / Decision Log へ反映
3. cron再開後、生成される記事にバリデーション/クリーンアップが正しく効いているか
   2〜3本分は人力レビュー
4. 記事が15-20本たまった時点でAdSense申請(README手順どおり)
5. 必要であればキュー(`data/topics.json`)にキーワードを追加(スキーマは本ファイル8節参照)

## 11. Relationship to Riku OS Master

このリポジトリは Riku OS 全体における「実行層」(コード・自動化・成果物)であり、
「意思決定・進捗管理層」は Riku OS Master に置く。両者を重複させないため、
案件の状態・優先度・次アクションの正は Riku OS Master 側に置き、本ファイルは
「今このリポジトリで何が起きているか」をコードと同じ場所で確認できる補助的な
Handoff層として位置づける。Riku OS Masterへの反映は下記パッケージを使うこと。

---

## Riku OS Writeback Package (write権限のあるAI/人間がそのまま反映用)

### PROJECT_REGISTRY_UPDATE

Project Registry表への新規行(既存の案件ID|案件名|領域|状態|優先度|次アクション|
締切・次の節目|最終更新|更新根拠|メモ 形式、AFF-SITE行と同じパターン):

```
| AFF-GADGET | ガジェット比較ラボ (Cloude repo) | 副業 | 進行中(Human Gate待ち) | 中 | ANTHROPIC_API_KEY をGitHub Secretsに登録して自動生成cronを復旧 | 記事15-20本蓄積後AdSense申請 | 2026-09-20 | GitHub Actions run 35451739635 / repo rkymgs310-cmyk/Cloude | Astro静的サイト。Claude APIで記事自動生成、毎日21時JST cron。ドメイン未取得・AdSense未申請・アフィリエイト未契約。 |  |
```

### PROGRESS_UPDATE

- project: AFF-GADGET
- date: 2026-09-20
- status: 進行中(コード基盤は健全、公開・収益化はHuman Gate待ち)
- completed:
  - cron失敗の根本原因を特定(`ANTHROPIC_API_KEY`未設定、3日連続失敗)
  - workflowにpreflight checkを追加し、Secret未設定時は失敗ではなくスキップ+
    actionableなstep summaryを出す形に変更
  - generate-post.mjs に構造バリデーション(必須フィールド・比較表有無・極端な短文検出)、
    スラッグ重複解消、AI定型文除去、重複段落検出(警告)、キーワード重複検出(警告)、
    優先度対応のキュー選択を追加
  - 記事ページに関連記事(内部リンク)機能を追加、ビルドで動作確認済み
  - `docs/AI_CONTEXT.md` を新設し、Cross-AI Handoff層を整備
- decisions: 下記 DECISION_UPDATE 参照
- files_changed: `scripts/generate-post.mjs`, `.github/workflows/generate-post.yml`,
  `src/pages/posts/[slug].astro`, `docs/AI_CONTEXT.md`, `README.md`
- systems_changed: GitHub Actions workflow (repo内のみ、Secret自体は変更していない)
- credentials_or_connections_status: `ANTHROPIC_API_KEY` 未設定のまま(このセッションでは
  設定不可、Human Gateとして記録するのみ)
- unresolved_issues: Riku OS Masterへの直接反映(write権限なし)、AdSense/アフィリエイト/
  ドメイン契約は全て未着手のHuman作業
- next_actions: 上記「10. Next actions」参照
- blockers: 下記 BLOCKER 参照
- source_of_truth: このリポジトリ(コード) + Riku OS Master(意思決定・進捗)
- handoff_notes: 次に触るAI/人間はまず本ファイルとREADME.mdを読めば追加の説明なしで
  再開できる状態にしてある

### DECISION_UPDATE

- ブロッカーがあってもプロジェクト全体を止めない方針に従い、`ANTHROPIC_API_KEY`未設定を
  Human Gateとして切り離し、それ以外(生成品質・失敗ハンドリング・内部リンク・
  ドキュメント)を安全に進めた
- Sheetsへの直接書き込み用の安全なスコープ付きツールがこのセッションに無いため、
  Riku OS Masterへの実書き込みはせず、Writebackパッケージとして明示的に残す方式を選択
  (175表・1.5MBの共有ファイルを汎用ファイル上書きで書き換えるのは不可逆リスクが高いと判断)
- 生成後バリデーションは「構造的に壊れている場合のみハードフェイル」
  (必須フィールド欠落・比較表なし・極端な短文)とし、文字数のブレや重複段落のような
  ソフトな品質問題は警告ログに留めた。1日1回のAPI呼び出しというコスト制約の中で、
  再生成コストを増やさずに壊れた記事の公開だけは確実に防ぐバランスを取った
- キューのスキーマは大幅な再設計をせず、`priority`のみ追加(過剰設計回避)

### BLOCKER

- id: HG-001
- type: Human Gate (billing / external credential)
- description: `ANTHROPIC_API_KEY` がGitHub Actions Secretsに未設定のため、記事自動生成
  cronが動作しない(2026-09-17〜19に3回失敗、2026-09-20よりpreflightでスキップ扱いに変更)
- owner: 人間(rkymgs310@gmail.com)
- required_action: README.md および本ファイル5節記載の3ステップ
- blocks: cronによる新規記事生成、記事本数の増加、AdSense申請の前提条件
- does_not_block: コード改善・generator品質向上・内部リンク・ドキュメント整備
  (すべて本セッションで対応済み)
