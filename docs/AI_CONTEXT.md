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

---

## Claude Review: `origin/gemini/riku-ai-os-bootstrap` (2026-09-20)

**レビュー担当**: Claude (このブランチ `claude/compassionate-cray-fjnmwg` 上でレビュー実施)
**対象**: `origin/gemini/riku-ai-os-bootstrap`(base: `b36ac69`、3コミット、
20ファイル / +2434 / -237)
**方法**: `git worktree` で対象ブランチを分離チェックアウトし、`npm ci` → `npm test` →
`npm run build` を実機実行。想像や過去ログでの判定は行っていない。
**マージ判断**: **保留**(ユーザー指示どおり。致命的な問題は検出されなかったが、
下記の軽微な指摘が未対応)

### 実機検証結果

- `npm test` → **33 tests / 33 pass**(9 suites, 0 fail, 実行時間 約170ms)
- `npm run build` → **成功**(13ページ + `/rss.xml` + `sitemap-index.xml` を生成、
  エラー・警告なし)
- 生成された `/tags/*` ディレクトリ名は生UTF-8(例: `dist/tags/AIツール/`)、
  `sitemap-index.xml` 側は正しく `%E3%83%84...` 形式でパーセントエンコードされている
  ことを確認(Astroのsitemap統合が自動処理。Cloudflare Pages/Vercel/Netlify等の
  主要静的ホストはリクエストパスをデコードしてファイルと突き合わせるため実運用上は
  問題ない見込みだが、実ホスティング接続後に一度目視確認を推奨)

### 総評

**回帰は検出されなかった。** Claudeが追加したバリデーション(必須フィールド・比較表検出・
スラッグ重複防止・禁止フレーズ除去・重複段落警告・優先度キュー選択)はGeminiのコミットで
全て維持され、さらに堅牢化されている(下記参照)。むしろ複数の潜在バグを修正している。

### 1. Generatorの変更に回帰がないか → **回帰なし、複数のバグ修正を確認**

- `slugify()` は元々 `article.slug || article.title || topic.keyword` の順で
  「最初の非空文字列」を採用していたが、日本語スラッグ/タイトルは非空のまま
  `slugify()`に通すと**空文字列になる**(a-z0-9以外を全除去するため)。
  Claude版にはこの潜在バグがあった(日本語タイトルが返るとほぼ確実に踏む経路)。
  Geminiの `resolveSlug()` は「slugify後に空でない候補」まで順にフォールバックし、
  全滅時は `post-{index}` にフォールバックする実装に修正済み。**正しい修正。**
- `extractJson()` にMarkdownコードフェンス(` ```json `)抽出と末尾カンマ自動修復を追加。
  Claude Haiku/Sonnetの応答が稀にコードフェンス付きで返る場合の実運用上のフェイル
  セーフとして妥当。
- `main()` を `export` して `isMain` ガード(`process.argv[1]`比較)を追加し、
  テストからの `import` 時に本番の `main()` が誤発火しない設計に変更。妥当な設計。
- `validateArticle()` に tags の正規化(文字列/配列混在への耐性)を追加。
  Astro Content CollectionsのZodスキーマ(`tags: z.array(z.string())`)違反による
  ビルド破壊を未然に防ぐ、実際に価値のある堅牢化。
- `hasMarkdownTable()` の正規表現を緩和(外枠パイプなしの表にも対応)。
  緩和により誤検出(false positive)が増える理論的リスクはあるが、後続の区切り行
  (`-+`)判定で担保されており、テストケース(4パターン)で実際に確認した限り妥当。

### 2. 33テストは妥当か → **妥当**

- パディング的な無意味アサーションはなく、`slugify`/`dedupeSlug`/`resolveSlug`/
  `extractJson`/`pickNextTopic`/`stripBannedPhrases`/`hasMarkdownTable`/
  `validateArticle`の各純粋関数と`topics.json`整合性を実際にexerciseしている。
- 33件の内訳を実カウントで確認: slugify(4) + dedupeSlug(3) + resolveSlug(5) +
  extractJson(4) + pickNextTopic(4) + stripBannedPhrases(3) + hasMarkdownTable(4) +
  validateArticle(5) + topics.json整合性(1) = 33。誇張なし。
- 外部API呼び出し(Anthropic API)はテスト対象外(コスト・再現性の観点で妥当な判断。
  AGENTS.md 3.3の「偽装レスポンスで成功を装わない」原則にも合致)。

### 3. topics.json 32件の重複・品質 → **重複なし。カテゴリ運用上の軽微な注意点のみ**

- Python(`json`モジュール)で全32件のキーワードをセット比較 → **完全一致の重複ゼロ**
- `done: true` の4件は既存の公開記事(slug)と完全一致 → 整合性OK
- キーワードに実在の製品名/ブランド(`MagSafe`, `エアタグ`, `GaN`, `Perplexity`等)が
  含まれるが、いずれも一般に広く知られた実在の技術・製品カテゴリであり、
  generatorのシステムプロンプトが禁じる「実在しない製品名の捏造」には該当しない。
  ただし商標を含むキーワードで記事を書く以上、本文中で当該ブランドの独自機能を
  断定的に書かないよう(既存のシステムプロンプトの「不確かな事実の断定を避ける」
  ルールで一定担保されてはいるが)、生成記事レビュー時に軽く意識すると良い
- テーマの軽微な重複感(例: #6 ワイヤレスイヤホン ノイズキャンセリング と
  #19 骨伝導イヤホン、#2/#16 モバイルバッテリー系)はあるが、検索意図・訴求軸が
  明確に異なるため許容範囲(SEOカニバリゼーションの実害は小さい)

### 4. RSS / JSON-LD / SEO / タグページ → **概ね良好。軽微な修正推奨あり**

問題なし・良い点:
- RSSはゼロ依存(`src/pages/rss.xml.ts`、外部パッケージなし)、`title`/`description`は
  CDATAで正しくエスケープ、ビルドで `/rss.xml` 生成を実機確認済み
- JSON-LD(`BlogPosting` + `BreadcrumbList`)は実データで構造検証、Googleリッチリザルト
  要件(headline/datePublished/author/publisher等)を満たす
- タグ一覧・タグ別アーカイブの内部リンクは全箇所で `encodeURIComponent()` を一貫使用
  (index.astro / posts/[slug].astro / tags/index.astro 全て確認済み、表記漏れなし)

推奨修正(軽微、いずれもブロッカーではない):

**(a) JSON-LDの `</script>` エスケープ漏れ**(`src/pages/posts/[slug].astro:98`)。
LLM生成のtitle/descriptionに万一 `</script>` という文字列が混入すると、埋め込み
scriptタグが途中で閉じられHTMLが壊れる。現状の信頼モデル(topics.jsonはサイト運営者
のみが編集)ではリスクは低いが、多層防御として一行で塞げる:
```diff
- <script type="application/ld+json" set:html={JSON.stringify(jsonLd)} />
+ <script type="application/ld+json" set:html={JSON.stringify(jsonLd).replace(/</g, '\\u003c')} />
```

**(b) RSSの `<category>` タグがXMLエスケープされていない**(`src/pages/rss.xml.ts:18`)。
`title`/`description`はCDATAで保護されているが、`tag`はそのまま埋め込まれている。
タグに `&` `<` `>` 等が混入するとRSS自体が不正XMLになる:
```diff
- ${post.data.tags.map((tag) => `<category>${tag}</category>`).join('\n      ')}
+ ${post.data.tags.map((tag) => `<category><![CDATA[${tag}]]></category>`).join('\n      ')}
```

**(c) `primaryTag` フォールバックが存在しないタグページを指す可能性**
(`src/pages/posts/[slug].astro:17`)。`post.data.tags[0] ?? 'ガジェット'` は、
仮にLLMがtagsを一つも返さず配列が空になった場合、パンくず・JSON-LDの
`BreadcrumbList` が `/tags/ガジェット/` を指すが、そのタグが実際にどの記事にも
付いていなければ**存在しないページへのリンク**になる(現状は「ガジェット」タグが
既存記事群で実際に使われているため顕在化していないが、構造的には脆い)。
`validateArticle()` 側でtags空配列を許容している以上、根本対応は生成側で
「tagsが空ならkeywordのカテゴリタグにフォールバックさせる」か、表示側で
「実在するタグ一覧に含まれる場合のみリンク化する」ガードを入れるとより堅牢。

**(d) `public/robots.txt` がプレースホルダドメインをハードコード**。
`astro.config.mjs` の `site` を本番ドメインに変更しても(README手順4)、
`public/robots.txt` は静的ファイルのため**自動追従しない**。ドメイン切替時に
このファイルの更新を忘れるとGoogle Search ConsoleがSitemapを誤URLで参照し続ける。
`rss.xml.ts` と同様に `src/pages/robots.txt.ts` として動的生成に寄せるか、
README「3. ドメイン取得&ホスティング契約」の手順に
「`public/robots.txt` のSitemap URLも実ドメインに更新すること」を一行追記するとよい。

### 5. GitHub Actions / CI → **良好**

- `ci.yml`: 全ブランチ・全PRで `npm test` → `npm run build` を実行。妥当なスコープ。
- `generate-post.yml`: 生成前に`npm test`、生成後に`npm run build`を実行し、
  ビルドが壊れる場合は**コミットされない**(GitHub Actionsのデフォルト動作として、
  前段のstepが失敗すると`if:`条件付きの後続stepは暗黙に`success()`とANDされ
  スキップされることを確認済み)。壊れたコンテンツが誤って公開される事故を
  仕組みで防いでおり、良い設計。
- `git push origin HEAD:${{ github.ref_name }}` への変更は、Claude版の素の`git push`
  より安全(意図しないブランチへのpushを防ぐ、AGENTS.md 3.1のブランチ分離原則に合致)。

軽微な指摘: `ci.yml` に `permissions:` ブロックが明示されていない
(`generate-post.yml`は`contents: write`を明示済み)。テスト・ビルドのみ行い
書き込みは不要なため、最小権限原則として明示するとより良い:
```diff
 jobs:
   test-and-build:
     runs-on: ubuntu-latest
+    permissions:
+      contents: read
     steps:
```

### 6. セキュリティ → **重大な問題なし**

- ハードコードされたAPIキー・トークン・秘密鍵: **検出されず**(正規表現でリポジトリ
  全体をスキャン済み)
- `.env` / `.gitignore` の扱いに変更なし、`.env.example` のみでSecretの雛形管理を継続
- `eval()` / `new Function()` / 危険な`dangerouslySetInnerHTML`相当の使用: **なし**
  (`set:html`の使用箇所は前述のJSON-LD 1箇所のみ、上記(a)で軽微な追加防御を提案)
- 外部ネットワーク依存の新規追加: Google Fonts(`fonts.googleapis.com`/`fonts.gstatic.com`)
  への `preconnect` + stylesheet読み込みが新規追加された。ゼロ依存方針からの小さな
  逸脱だが、実害(プライバシー/表示速度)は軽微。気になる場合はセルフホスト
  フォント化も検討可(必須ではない)

### 7. 不要な複雑化がないか → **概ね適切。1点のみ軽微な重複あり**

- UI/UXデザイン刷新・タグ回遊・JSON-LD・RSS・CI・テスト・キュー拡充は、いずれも
  事前に許可された作業カテゴリ(SEO改善/internal linking/QA/CI/documentation等)に
  対応しており、過剰な抽象化や不要な依存追加(状態管理ライブラリ、UIフレームワーク
  等)は見られない。Astro単体構成のまま。
- **軽微な重複**: `calcReadingTime()` 関数が `index.astro` / `tags/[tag].astro` /
  `posts/[slug].astro` の3ファイルに全く同じ実装でコピーされている。
  `src/lib/reading-time.ts` 等に切り出して1箇所に集約するのが望ましい
  (機能に影響はないため、緊急度は低い)。

### 結論・推奨アクション

1. **マージはユーザー指示どおり保留**。上記(a)〜(f)はいずれも軽微でブロッカーではない
   ため、マージ自体を妨げるものではない
2. 対応するなら優先度順に: (d) robots.txtドメイン同期の注意書き >
   (b) RSS category XMLエスケープ > (a) JSON-LD scriptエスケープ >
   (f) calcReadingTime共通化 > (e) ci.yml permissions明示 > (c) primaryTagフォールバック
3. 次にこのブランチを触るAI/人間は、上記diffをそのまま `gemini/riku-ai-os-bootstrap`
   または統合先ブランチに適用すれば良い(本レビューでは対象ブランチのコードは
   一切変更していない。提案のみ)
