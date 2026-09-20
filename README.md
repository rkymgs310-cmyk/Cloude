# ガジェット比較ラボ

AI/ガジェット系のニッチサイトです。Claude APIで記事を自動生成し、GitHub Actionsの
スケジュール実行で「生成 → コミット → 自動デプロイ」を回す構成になっています。

> **AI/coding agentへ**: 共通運用規約は [`AGENTS.md`](AGENTS.md)、現在のブロッカー・自動化の状態・次にやるべきことは
> [`docs/AI_CONTEXT.md`](docs/AI_CONTEXT.md) にまとめてあります。作業前に必ず確認してください。

## 構成

- **Astro** — 静的サイトジェネレーター(高速・SEOに強い)
- **`src/content/posts/`** — 記事本体(Markdown)。Content Collectionsで管理
- **`data/topics.json`** — 記事化するキーワードのキュー
- **`scripts/generate-post.mjs`** — キューから1件取り出しClaude APIで記事を生成
- **`tests/`** — 生成・バリデーションロジックの単体テストスイート
- **`.github/workflows/generate-post.yml`** — 毎日自動で記事生成→push するcron
- **`.github/workflows/ci.yml`** — テストとビルドの自動検証CI

## ローカルでの動作確認

```bash
npm install
npm test          # 単体テストの実行(node:test)
npm run dev       # http://localhost:4321 で確認
npm run build     # 本番ビルド(dist/に出力)
```

記事を1本手動生成したい場合:

```bash
ANTHROPIC_API_KEY=sk-ant-xxxx npm run generate:post
```

`GENERATE_POST_MODEL` 環境変数でモデルを変更できます(デフォルトは低コストな
`claude-haiku-4-5-20251001`。品質重視なら `claude-sonnet-5` などに変更可)。

## ここから先はあなた自身で行う必要がある手続き

ドメイン取得・広告契約・アフィリエイト契約は本人確認や支払い情報の登録が必要なため、
Claudeでは代行できません。以下の順番で進めてください。

### 1. リポジトリをGitHubにpushする

このブランチ(または内容)をGitHubリポジトリのデフォルトブランチにマージしてください。

### 2. Anthropic APIキーを取得し、GitHub Secretsに登録

1. https://console.anthropic.com でAPIキーを発行し、支払い方法を登録
2. GitHubリポジトリの `Settings > Secrets and variables > Actions` で
   `ANTHROPIC_API_KEY` という名前のSecretを追加
3. `Actions` タブから `Generate daily post` を手動実行(`Run workflow`)して
   動作確認する

参考コスト目安: Haikuモデルなら1記事あたり数円〜十数円程度(モデルの価格改定で
変動するため、Anthropicコンソールの使用量を定期的に確認してください)。

### 3. ドメイン取得 & ホスティング契約

1. 好きなレジストラでドメインを取得(お名前.com、Cloudflare Registrar等)
2. [Cloudflare Pages](https://pages.cloudflare.com/) または
   [Vercel](https://vercel.com/) にGitHubリポジトリを接続
   - Build command: `npm run build`
   - Output directory: `dist`
3. 独自ドメインを接続
4. `astro.config.mjs` の `site` を実際のドメインに変更してpush
   (sitemap.xmlの生成に必要)

pushするたびに自動でビルド・デプロイされるので、cronで記事が追加されると
サイトも自動更新されます。

### 4. `about.astro` / `contact.astro` の仮情報を実情報に差し替える

`src/pages/about.astro` と `src/pages/contact.astro` の `TODO` コメント箇所を、
実際の運営者名・連絡先メールアドレスに書き換えてください。
AdSense審査や訪問者からの信頼性のために必須です。

### 5. Google AdSenseに申請

1. 記事が15〜20本程度たまり、独自ドメインでの運用実績が数週間できてから
   https://www.google.com/adsense/ で申請
2. 審査には運営者情報・プライバシーポリシーページが必須(既に用意済み)
3. 承認されたら発行される `ca-pub-xxxxxxxxxxxxxxxx` を
   ホスティング側の環境変数 `PUBLIC_ADSENSE_CLIENT_ID` に設定
4. 広告ユニットを作成し、そのスロットIDを `PUBLIC_ADSENSE_SLOT_ID` に設定
5. 再デプロイすると記事ページに広告が表示されるようになります
   (`src/components/AdSlot.astro` が両方の環境変数が揃うまで自動的に非表示にします)

### 6. Amazonアソシエイト(または他のASP)に申請

1. https://affiliate.amazon.co.jp/ で申請(サイトにある程度コンテンツが必要)
2. 承認後、紹介したい商品のアソシエイトリンクを取得
3. 記事内で `<AffiliateLink href="..." label="..." />` コンポーネントを使って
   リンクを追加(`href` を渡さないと「リンク準備中」と表示され、空リンクを
   公開してしまうミスを防げます)

### 7. 運用を回す

- 平常運転になったらキーワードは `data/topics.json` に追記するだけで
  自動的に記事化されていきます
- 生成された記事は一度は人間の目でざっと確認することを推奨します
  (事実誤認や不自然な内容がないかのチェック)
- 収益が発生したら、個人事業として確定申告が必要になる場合があります。
  国税庁のサイトや税理士に相談してください。

## 注意事項

- AIが生成した記事に、実在しない製品名や不確かな数値が紛れ込む可能性があります。
  公開前に軽く目を通す運用を推奨します。
- 「完全放置で即収益」にはならず、AdSense審査やSEOでの検索流入が育つまで
  数週間〜数か月は収益がほぼゼロの助走期間があります。
