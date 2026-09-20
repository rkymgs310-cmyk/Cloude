# AI_CONTEXT.md — この案件を初めて見るAI/人間向けの状態ファイル

このファイルは Riku AI OS の Handoff層です。ChatGPT / Gemini / 他のcoding agent /
人間が、会話履歴やモデル固有Memoryなしにこのリポジトリの現在地を把握できるようにする
ことが目的です。正本は Google Drive の **Riku OS Master** スプレッドシートですが、
このセッションではそこへ直接書き込む権限/安全な手段がなかったため、反映用データを
末尾の「Riku OS Writeback Package」にそのまま貼り付け可能な形で保持しています。

- **Project ID**: `AFF-GADGET`
- **Canonical GitHub Repository**: `rkymgs310-cmyk/Cloude`
- **Current Branch**: `gemini/riku-ai-os-bootstrap`
- **Last updated**: 2026-09-20 (Gemini session, following Claude session)

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
- `tests/generate-post.test.mjs` — `node:test` による生成ロジックの単体テストスイート
- `.github/workflows/generate-post.yml` — 毎日 21:00 JST の cron + 手動実行(`workflow_dispatch`)
- `.github/workflows/ci.yml` — 全プッシュ/PRに対するテスト・ビルド検証CI
- `public/robots.txt` & `public/favicon.svg` — クローラー向けサイトマップ参照・アイコン
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
- リポジトリの作業ブランチは `gemini/riku-ai-os-bootstrap`

## 4. Automation

- GitHub Actions (`generate-post.yml`) が毎日1本、キューから記事を自動生成・commit・push
- 2026-09-20 (Claude session):
  - **Preflight check**: `ANTHROPIC_API_KEY` 未設定時は生成をスキップし、
    `$GITHUB_STEP_SUMMARY` に対応手順を明示して**成功扱いで終了**(無意味な毎日赤X通知を防止)
  - **Generator側バリデーション**: タイトル/説明/スラッグ/本文の必須チェック、
    比較表(Markdownテーブル)の有無チェック、本文が極端に短い場合はエラーで停止
  - **スラッグ重複防止**: 生成スラッグが既存記事/キューと衝突する場合は `-2`, `-3` を自動付与
  - **定型AI締め文句の自動除去**(「いかがでしたか」等を含む文を削除)
  - **重複段落検出**(完全一致する段落が2回以上出現した場合、ログに警告を出力。生成は止めない)
  - **キーワード重複検出**(`data/topics.json` 内の重複キーワードを実行時に警告)
  - **優先度対応のキュー選択**(`topics.json` の各エントリに任意で `priority: "high"|"low"` を
    付けられる。未指定は通常優先度として扱われる)
- 2026-09-20 (Gemini session):
  - **単体テストスイート新設**: Node.js標準の `node:test` を用いた32テスト(`tests/generate-post.test.mjs`)を追加。外部依存ゼロで高速・堅牢に純粋関数を検証可能化
  - **スラッグ生成の多段フォールバック**: モデルが非ASCIIスラッグを返した場合でも、`article.title` → `topic.keyword` → `post-{index}` と安全にフォールバックし、空スラッグ(`.md` や `-2.md`)の作成事故を完全防止
  - **JSONパース耐障害性向上**: Markdownコードブロック(` ```json ... ``` `)内の抽出や、LLMが混入させやすい末尾カンマ(trailing comma)の自動修復・再パースを追加
  - **タグ正規化**: モデルがカンマ区切り文字列でタグを返した場合でも安全に配列化・トリム・空要素除外を行い、Astro Content Collectionsスキーマ違反によるビルド破損を防止
  - **定型句除去・テーブル検出の強化**: 段落全削除時の空段落除去、追加禁止フレーズの拡充、テーブル検出の外枠パイプ有無への対応
  - **ワークフロー安全性向上**:
    - `generate-post.yml`: 生成前にテスト実行、記事生成後に `npm run build` を実行してビルドが通る場合のみcommit & pushするガードを追加。push先を明示的にターゲットブランチ(`origin HEAD:${{ github.ref_name }}`)に指定
    - `ci.yml`: 全branch/PRに対するテスト & ビルド自動検証CIを新設
  - **SEO & OGPメタタグ改善**:
    - `BaseLayout.astro`: トップページでのタイトル重複(`ガジェット比較ラボ | ガジェット比較ラボ`)を解消し、`og:site_name`, `og:url`, `og:type` (website/articleの切り替え), `twitter:card`, `twitter:title`, `twitter:description` を網羅
    - `public/robots.txt` (クローラー向けサイトマップ明示) および `public/favicon.svg` を新設(404防止)
  - **トピックキュー同期**: `topics.json` に未反映だった公開済み記事 `best-ai-note-taking-apps-2026` を同期(計16件: 完了4件、未処理12件)

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

- `scripts/generate-post.mjs` — 生成ロジック本体(バリデーション・フォールバック含む)
- `tests/generate-post.test.mjs` — 生成ロジックの単体テストスイート
- `data/topics.json` — キーワードキュー (16件)
- `.github/workflows/generate-post.yml` — 自動生成・検証・コミットワークフロー
- `.github/workflows/ci.yml` — テスト・ビルドCI
- `src/layouts/BaseLayout.astro` — OGP/SEO/Favicon対応の共通レイアウト
- `src/content/config.ts` — 記事スキーマ
- `src/pages/posts/[slug].astro` — 記事ページ(関連記事ロジック含む)
- `public/robots.txt` — クローラー制御・サイトマップ案内
- `public/favicon.svg` — サイトファビコン
- `README.md` — 人間が行うべき手続き(ドメイン/AdSense/アフィリエイト等)の詳細手順

## 8. Current queue (data/topics.json)

16キーワード中、4件処理済み(`done: true`)。未処理は12件
(スマート家電・ガジェット・AIツールカテゴリ)。スキーマ: `keyword`, `tags`, 任意で
`priority`("high"/"low"、未指定は通常優先度)、生成後は自動付与される `done`, `slug`,
`generatedAt`。

## 9. Latest verification (2026-09-20 Gemini session)

- `npm test` → 32件の単体テスト全て合格(8スイート、0件失敗、実行時間 約380ms)
- `npm run build` → 成功(8ページ静的HTML + sitemap生成、エラーなし)
- `dist/robots.txt` および `dist/favicon.svg` の生成・配置確認済み
- `dist/index.html` および `dist/posts/smart-plug-guide/index.html` のOGP/タイトル生成確認済み
- GitHub Actions workflow (`generate-post.yml`, `ci.yml`) の構文確認済み

## 10. Next actions

優先度順:
1. **(Human Gate)** `ANTHROPIC_API_KEY` をGitHub Secretsに登録 → cron再開
2. **(Human Gate / write権限のあるAI)** 本ファイル末尾のWritebackパッケージを
   Riku OS Master の Project Registry / Progress Log / Decision Log へ反映
3. cron再開後、生成される記事にバリデーション/クリーンアップが正しく効いているか
   2〜3本分は人力レビュー
4. 記事が15-20本たまった時点でAdSense申請(README手順どおり)
5. 必要であればキュー(`data/topics.json`)にキーワードを追加

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
| AFF-GADGET | ガジェット比較ラボ (Cloude repo) | 副業 | 進行中(Human Gate待ち) | 中 | ANTHROPIC_API_KEY をGitHub Secretsに登録して自動生成cronを復旧 | 記事15-20本蓄積後AdSense申請 | 2026-09-20 | GitHub Actions run 35451739635 / repo rkymgs310-cmyk/Cloude | Astro静的サイト。Claude APIで記事自動生成、毎日21時JST cron。単体テスト(32件)・CI配備済み。ドメイン未取得・AdSense未申請・アフィリエイト未契約。 |  |
```

### PROGRESS_UPDATE

- project: AFF-GADGET
- date: 2026-09-20
- status: 進行中(コード基盤・単体テスト・CI・SEOは完了、自動生成と収益化はHuman Gate待ち)
- completed:
  - Claude作業の全検証(Astroビルド、内部リンク、スキーマ、プレフライト)
  - `node:test` を用いた32項目の単体テストスイート (`tests/generate-post.test.mjs`) を新設
  - `scripts/generate-post.mjs` を堅牢化:
    - スラッグ解決の多段フォールバック (`article.slug` → `article.title` → `topic.keyword` → `post-{index}`) で空スラッグによるファイル異常を防止
    - JSONコードブロック抽出 & 末尾カンマ自動修復
    - タグ入力の配列正規化 (文字列で返された場合のパース・トリム)
    - 不要段落の完全除去 & AI定型文フィルタの拡充
    - 純粋関数エクスポートとCLI実行判定
  - 自動生成ワークフロー (`generate-post.yml`) にテスト実行およびコミット前の `npm run build` 検証を追加 (壊れた記事のpushを未然防止)
  - PR・プッシュ自動検証用の `ci.yml` を追加
  - SEO・OGP・メタ情報の強化 (`BaseLayout.astro` の重複タイトル解消、OGP/Twitterカード完備、`public/robots.txt`、`public/favicon.svg`)
  - `data/topics.json` と既存記事の整合性同期 (全16件中 完了4件・未処理12件)
- decisions: 下記 DECISION_UPDATE 参照
- files_changed: `scripts/generate-post.mjs`, `tests/generate-post.test.mjs`, `package.json`,
  `.github/workflows/generate-post.yml`, `.github/workflows/ci.yml`,
  `src/layouts/BaseLayout.astro`, `src/pages/posts/[slug].astro`,
  `public/robots.txt`, `public/favicon.svg`, `data/topics.json`, `docs/AI_CONTEXT.md`, `README.md`
- systems_changed: GitHub Actions workflows (`generate-post.yml`, `ci.yml`)
- credentials_or_connections_status: `ANTHROPIC_API_KEY` 未設定のまま(Human Gateとして継続管理)
- unresolved_issues: Riku OS Masterへの直接反映(write権限なし)、AdSense/アフィリエイト/
  ドメイン契約は全て未着手のHuman作業
- next_actions: 上記「10. Next actions」参照
- blockers: 下記 BLOCKER 参照
- source_of_truth: このリポジトリ(コード) + Riku OS Master(意思決定・進捗)
- handoff_notes: Claudeによる初期構築をGeminiセッションでテスト自動化・堅牢化・SEO強化・CI整備まで推進。外部クレデンシャル待ち以外の安全なタスクは完了

### DECISION_UPDATE

- 外部テストフレームワーク(Jest/Vitest)を追加せず、Node.js 22/24標準の `node:test` と `node:assert/strict` を採用。追加パッケージや依存関係の脆弱性リスクをゼロに保ちながら高速なテスト実行を実現
- 生成ワークフロー内で、記事生成直後・commit直前に `npm run build` を挟む設計を採用。APIが不正なMarkdownやFrontmatterを出力した場合にリポジトリへ破損コミットが混入するのを未然に遮断
- スラッグ生成においてモデル出力が純日本語等の非ASCIIだった場合のフォールバック先として、タイトル→キーワード→キューインデックスの3段構えを導入し、壊れたファイル名(`.md` や `-2.md`)の発生を恒久防止
- Human Gate(`ANTHROPIC_API_KEY`)に起因する待ちはそのまま明示し、立ち止まらずにコード品質・自動テスト・CI・SEO・データ整合性を前進させる方針を徹底

### BLOCKER

- id: HG-001
- type: Human Gate (billing / external credential)
- description: `ANTHROPIC_API_KEY` がGitHub Actions Secretsに未設定のため、記事自動生成
  cronが動作しない(2026-09-17〜19に3回失敗、2026-09-20よりpreflightでスキップ扱いに変更)
- owner: 人間(rkymgs310@gmail.com)
- required_action: README.md および本ファイル5節記載の3ステップ
- blocks: cronによる新規記事生成、記事本数の増加、AdSense申請の前提条件
- does_not_block: コード改善・単体テスト整備・CI配備・SEO改善・ドキュメント整備(すべて本セッションで対応済み)
