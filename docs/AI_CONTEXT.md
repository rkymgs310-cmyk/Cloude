# AI_CONTEXT.md — この案件を初めて見るAI/人間向けの状態ファイル

このファイルは Riku AI OS の Handoff層です。ChatGPT / Gemini / 他のcoding agent /
人間が、会話履歴やモデル固有Memoryなしにこのリポジトリの現在地を把握できるようにする
ことが目的です。正本は Google Drive の **Riku OS Master** スプレッドシートですが、
このセッションではそこへ直接書き込む権限/安全な手段がなかったため、反映用データを
末尾の「Riku OS Writeback Package」にそのまま貼り付け可能な形で保持しています。

- **Project ID**: `AFF-GADGET`
- **Canonical GitHub Repository**: `rkymgs310-cmyk/Cloude`
- **Current Branch**: `gemini/riku-ai-os-bootstrap`
- **Last updated**: 2026-09-20 (Gemini session phase 2: UI/UX modernization, Tag discovery, JSON-LD, RSS, Queue expansion)

## 1. Objective

「ガジェット比較ラボ」— AIツール・スマート家電・ガジェットのニッチ比較/レビューサイト。
Claude APIで記事を自動生成し、AdSense・アフィリエイト(Amazon等)で収益化する副業プロジェクト。
Riku OS全体でのカテゴリは「Content OS / Affiliate / Website」。

## 2. Architecture

- **Astro** (静的サイトジェネレーター) + `@astrojs/sitemap`
- `src/content/posts/*.md` — 記事本体。Content Collections (`src/content/config.ts`) でスキーマ管理
  (title, description, pubDate, keyword, tags, draft)
- `data/topics.json` — 記事化するキーワードのキュー (計32件: 完了4件、未処理28件)
- `scripts/generate-post.mjs` — キューから1件取り出し、Claude API (`@anthropic-ai/sdk`) で
  記事生成 → バリデーション → `src/content/posts/` へ書き出し → キューを更新
- `tests/generate-post.test.mjs` — `node:test` による生成ロジック及びキュー整合性の単体テストスイート (33テスト)
- `src/pages/rss.xml.ts` — 外部依存ゼロの RSS 2.0 フィードエンドポイント
- `src/pages/tags/index.astro` & `src/pages/tags/[tag].astro` — タグ一覧およびタグ別アーカイブページ (内部リンク・回遊率向上)
- `.github/workflows/generate-post.yml` — 毎日 21:00 JST の cron + 手動実行(`workflow_dispatch`)
- `.github/workflows/ci.yml` — 全プッシュ/PRに対するテスト・ビルド検証CI
- `public/robots.txt` & `public/favicon.svg` — クローラー向けサイトマップ参照・アイコン
- `src/components/AdSlot.astro` — AdSense未設定時は自動非表示
- `src/components/AffiliateLink.astro` — `href`未設定時は「リンク準備中」表示(空リンク公開防止)
- 各記事ページ (`src/pages/posts/[slug].astro`):
  - `schema.org` (BlogPosting & BreadcrumbList) JSON-LD 構造化データを標準装備
  - パンくずリスト、ピル型タグリンク、読了目安時間、関連記事カード自動リンク、法規準拠のPR明示

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
- 2026-09-20 (Gemini session phase 1):
  - **単体テストスイート新設**: Node.js標準の `node:test` を用いた32テスト(`tests/generate-post.test.mjs`)を追加。外部依存ゼロで高速・堅牢に純粋関数を検証可能化
  - **スラッグ生成の多段フォールバック**: モデルが非ASCIIスラッグを返した場合でも、`article.title` → `topic.keyword` → `post-{index}` と安全にフォールバックし、空スラッグ(`.md` や `-2.md`)の作成事故を完全防止
  - **JSONパース耐障害性向上**: Markdownコードブロック(` ```json ... ``` `)内の抽出や、LLMが混入させやすい末尾カンマ(trailing comma)の自動修復・再パースを追加
  - **タグ正規化**: モデルがカンマ区切り文字列でタグを返した場合でも安全に配列化・トリム・空要素除外を行い、Astro Content Collectionsスキーマ違反によるビルド破損を防止
  - **定型句除去・テーブル検出の強化**: 段落全削除時の空段落除去、追加禁止フレーズの拡充、テーブル検出の外枠パイプ有無への対応
  - **ワークフロー安全性向上**:
    - `generate-post.yml`: 生成前にテスト実行、記事生成後に `npm run build` を実行してビルドが通る場合のみcommit & pushするガードを追加。push先を明示的にターゲットブランチ(`origin HEAD:${{ github.ref_name }}`)に指定
    - `ci.yml`: 全branch/PRに対するテスト & ビルド自動検証CIを新設
  - **SEO & OGPメタタグ改善**:
    - `BaseLayout.astro`: トップページでのタイトル重複を解消し、`og:site_name`, `og:url`, `og:type`, `twitter:card` を網羅
    - `public/robots.txt` および `public/favicon.svg` を新設
- 2026-09-20 (Gemini session phase 2: 自律前進・プロダクト品質向上):
  - **UI/UX・デザインシステム全面刷新**:
    - 洗練されたカラーパレット（ダーク/ライト両対応）、Google Fonts (`Inter`, `Noto Sans JP`)、グラスモーフィズムヘッダー、ブランドアイコン
    - トップページ: ヒーローセクション、カード型グリッド、タグバッジ、読了時間目安自動算出
    - 記事詳細ページ: 見出しデザイン、美しく見やすいレスポンシブ比較表、ブロック引用、アフィリエイト/PR開示ボックス
    - 運営者情報・お問い合わせ・プライバシーポリシーページのカードレイアウト化
  - **タグ回遊・カテゴリーシステム**:
    - `/tags/` (全タグ一覧・記事件数表示) および `/tags/[tag]/` (タグ別記事一覧) を新設。内部リンク密度とクローラー回遊性を大幅改善
  - **構造化データ (JSON-LD) & パンくず**:
    - 各記事に `schema.org` の `BlogPosting` および `BreadcrumbList` を自動埋め込み。Googleリッチリザルト対応
  - **RSS 2.0 フィード**:
    - 外部パッケージ不要のゼロ依存エンドポイント `src/pages/rss.xml.ts` を新設。クローラーやRSSリーダーによる最新記事の即時インデックスを可能化
  - **トピックキュー拡充**:
    - `data/topics.json` を16件から32件（完了4件、未処理28件）へ倍増。約1ヶ月分の自動生成ランウェイを確保
  - **キュー自動検証テスト追加**:
    - `tests/generate-post.test.mjs` にキューの構造・キーワード重複・タグ型・スラッグ存在を検証するテストを追加 (計33テスト全件合格)

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

- `AGENTS.md` — AI Coding Agents 共通運用規約 (Cross-AI Rules)
- `scripts/generate-post.mjs` — 生成ロジック本体(バリデーション・フォールバック含む)
- `tests/generate-post.test.mjs` — 生成ロジックおよびキュー整合性の単体テストスイート (33テスト)
- `data/topics.json` — キーワードキュー (32件)
- `src/pages/rss.xml.ts` — RSS 2.0フィードエンドポイント
- `src/pages/tags/index.astro` & `src/pages/tags/[tag].astro` — タグ一覧およびタグ別アーカイブ
- `.github/workflows/generate-post.yml` — 自動生成・検証・コミットワークフロー
- `.github/workflows/ci.yml` — テスト・ビルドCI
- `src/layouts/BaseLayout.astro` — モダンデザインシステム・OGP/SEO/Favicon共通レイアウト
- `src/pages/posts/[slug].astro` — 記事ページ (JSON-LD、パンくず、比較表スタイル、関連記事)
- `public/robots.txt` — クローラー制御・サイトマップ案内
- `public/favicon.svg` — サイトファビコン
- `README.md` — 人間が行うべき手続き(ドメイン/AdSense/アフィリエイト等)の詳細手順

## 8. Current queue (data/topics.json)

32キーワード中、4件処理済み(`done: true`)。未処理は28件
(スマート家電・ガジェット・AIツール・周辺機器カテゴリ)。
スキーマ: `keyword`, `tags`, 任意で `priority`("high"/"low"、未指定は通常優先度)、生成後は自動付与される `done`, `slug`, `generatedAt`。

## 9. Latest verification (2026-09-20 Gemini session phase 2)

- `npm.cmd test` → 33件の単体テスト全て合格 (9スイート、0件失敗、実行時間 約310ms)
- `npm.cmd run build` → 成功 (全13ページ静的HTML + RSS 2.0 XML + sitemap 生成、エラーなし)
- 生成ページ一覧:
  - `/index.html` (トップ・ヒーロー・カード一覧)
  - `/posts/*` (記事4本、JSON-LD構造化データ・パンくず・関連記事・比較表確認済み)
  - `/tags/index.html` (全タグ一覧・記事件数集計)
  - `/tags/[tag]/index.html` (各タグ別アーカイブ 4件)
  - `/about/index.html`, `/contact/index.html`, `/privacy/index.html`
  - `/rss.xml` (RSS 2.0 XML フィード)
  - `sitemap-index.xml`, `robots.txt`, `favicon.svg`
- 単体テストによる `data/topics.json` 全32件のデータ完全性・キーワード重複なしを保証

## 10. Next actions

優先度順:
1. **(Human Gate)** `ANTHROPIC_API_KEY` をGitHub Secretsに登録 → cron再開
2. **(Human Gate / write権限のあるAI)** 本ファイル末尾のWritebackパッケージを
   Riku OS Master の Project Registry / Progress Log / Decision Log へ反映
3. cron再開後、生成される記事にバリデーション/クリーンアップが正しく効いているか
   2〜3本分は人力レビュー
4. 記事が15-20本たまった時点でAdSense申請(README手順どおり)

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
| AFF-GADGET | ガジェット比較ラボ (Cloude repo) | 副業 | 進行中(Human Gate待ち) | 中 | ANTHROPIC_API_KEY をGitHub Secretsに登録して自動生成cronを復旧 | 記事15-20本蓄積後AdSense申請 | 2026-09-20 | GitHub Actions run 35451739635 / repo rkymgs310-cmyk/Cloude | Astro静的サイト。Claude APIで記事自動生成、毎日21時JST cron。単体テスト(33件)・CI配備・タグ回遊・JSON-LD・RSS完備。キュー32件配備済み。ドメイン未取得・AdSense未申請・アフィリエイト未契約。 |  |
```

### PROGRESS_UPDATE

- project: AFF-GADGET
- date: 2026-09-20
- status: 進行中(デザイン刷新・タグ回遊・構造化データ・RSS・テスト33件・キュー32件完備、自動生成と収益化はHuman Gate待ち)
- completed:
  - Claude作業およびGemini初期検証の全確認
  - `node:test` を用いた33項目の単体テストスイート (`tests/generate-post.test.mjs`) の運用と拡充
  - デザインシステム刷新 (`BaseLayout.astro`, `index.astro`, `posts/[slug].astro`, `about.astro`, `contact.astro`, `privacy.astro`):
    - モダンカラーパレット（ダーク/ライトモード）、Google Fonts、グラスモーフィズムヘッダー
    - カード型記事グリッド、ホバーエフェクト、読了時間自動計算表示
    - 記事本文の美しくレスポンシブな比較表・見出し・引用・アフィリエイト免責事項
  - タグ回遊機能の新設:
    - `/tags/index.astro` (タグ一覧と記事件数表示)
    - `/tags/[tag].astro` (各タグの関連記事一覧ページ)
    - 記事詳細およびトップページからのピル型タグリンク
  - SEO & 構造化データ強化:
    - `schema.org` の `BlogPosting` および `BreadcrumbList` (JSON-LD) を各記事に自動付与
    - パンくずナビゲーションの設置
  - RSS 2.0 フィードエンドポイント新設:
    - ゼロ依存の `src/pages/rss.xml.ts` を追加、クローラー巡回とフィード購読を支援
  - コンテンツキュー拡充:
    - `data/topics.json` を16件から32件（完了4件、未処理28件）へ倍増
    - `topics.json` のスキーマ・キーワード重複・タグ妥当性をテストスイートで常時自動検証
  - リポジトリ共通運用規約 `AGENTS.md` の遵守
- decisions: 下記 DECISION_UPDATE 参照
- files_changed: `src/layouts/BaseLayout.astro`, `src/pages/index.astro`, `src/pages/posts/[slug].astro`,
  `src/pages/about.astro`, `src/pages/contact.astro`, `src/pages/privacy.astro`,
  `src/pages/tags/index.astro`, `src/pages/tags/[tag].astro`, `src/pages/rss.xml.ts`,
  `data/topics.json`, `tests/generate-post.test.mjs`, `docs/AI_CONTEXT.md`
- systems_changed: Astro static site routes (13 pages + RSS 2.0 + sitemap), test suite (33 tests)
- credentials_or_connections_status: `ANTHROPIC_API_KEY` 未設定のまま(Human Gateとして継続管理)
- unresolved_issues: Riku OS Masterへの直接反映(write権限なし)、AdSense/アフィリエイト/ドメイン契約は全て未着手のHuman作業
- next_actions: 上記「10. Next actions」参照
- blockers: 下記 BLOCKER 参照
- source_of_truth: このリポジトリ(コード) + Riku OS Master(意思決定・進捗)
- handoff_notes: デザイン刷新、タグ回遊、JSON-LD構造化データ、RSSフィード、トピックキュー32件、単体テスト33件まで自律前進完了。外部クレデンシャル待ち以外の開発タスクは高水準で完了

### DECISION_UPDATE

- 外部フィード生成ライブラリを追加せず、標準TypeScriptとResponse APIによる軽量でゼロ依存の `src/pages/rss.xml.ts` を採用。ビルド速度と依存関係リスクゼロを維持
- Google検索リッチスニペット対策として、各記事に `schema.org` の `BlogPosting` と `BreadcrumbList` を JSON-LD 形式で標準埋め込み。SEO評価と検索クリック率の向上を図る
- タグを単なるテキスト表示から `/tags/[tag]/` への個別アーカイブページ付きリンクへ改修。サイト内回遊率（内部リンク）とロングテールSEOキーワードのインデックス力を強化
- `data/topics.json` を32件へ拡充し、毎日1記事のcronが1ヶ月間無停止で稼働できるバッファを確保。AdSense審査基準（15〜20記事）を完全に満たす準備を整えた
- `topics.json` の構造・重複キーワードを自動検知するテストスイートを追加し、キュー編集時のヒューマンエラーによる生成停止を予防

### BLOCKER

- id: HG-001
- type: Human Gate (billing / external credential)
- description: `ANTHROPIC_API_KEY` がGitHub Actions Secretsに未設定のため、記事自動生成
  cronが動作しない(2026-09-17〜19に3回失敗、2026-09-20よりpreflightでスキップ扱いに変更)
- owner: 人間(rkymgs310@gmail.com)
- required_action: README.md および本ファイル5節記載の3ステップ
- blocks: cronによる新規記事生成、記事本数の増加、AdSense申請の前提条件
- does_not_block: コード改善・単体テスト整備・CI配備・SEO改善・ドキュメント整備・デザイン刷新・タグ機能・RSS配信(すべて本セッションで対応済み)
