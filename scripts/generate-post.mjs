#!/usr/bin/env node
// キーワードキュー(data/topics.json)から未処理のトピックを1件取り出し、
// Claude APIで下書きを作成し、リポジトリ外に保存する。公開・キュー完了は手動レビュー後。
// API利用・費用の承認とローカル専用設定について README.md を参照。

import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openPrivateDraftDirectory, readPendingDrafts, withDraftLock, saveDraft } from './private-drafts.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';

// 生成AIが書きがちな定型の締め文句。含む文をまるごと除去する。
export const BANNED_PHRASES = [
  'いかがでしたか',
  'いかがでしたでしょうか',
  'いかがだったでしょうか',
  '本記事が少しでも参考になれば幸いです',
  '参考になれば幸いです',
  'この記事が少しでもお役に立てば嬉しいです',
  'お役に立てれば幸いです',
  '最後までお読みいただきありがとうございました',
];

export const PRIORITY_RANK = { high: 0, 高: 0, mid: 1, normal: 1, low: 2, 低: 2 };

export function slugify(input) {
  if (!input || typeof input !== 'string') return '';
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
}

export function dedupeSlug(baseSlug, used) {
  if (!used.has(baseSlug)) return baseSlug;
  let n = 2;
  while (used.has(`${baseSlug}-${n}`)) n += 1;
  return `${baseSlug}-${n}`;
}

export function resolveSlug(article, topic, fallbackIndex, used = new Set()) {
  const candidates = [
    article?.slug,
    article?.title,
    topic?.keyword,
  ];
  let baseSlug = '';
  for (const candidate of candidates) {
    const s = slugify(candidate ?? '');
    if (s) {
      baseSlug = s;
      break;
    }
  }
  if (!baseSlug) {
    const fallbackNum = typeof fallbackIndex === 'number' ? fallbackIndex + 1 : Date.now();
    baseSlug = `post-${fallbackNum}`;
  }
  return dedupeSlug(baseSlug, used);
}

export function extractJson(text) {
  if (!text || typeof text !== 'string') {
    throw new Error('Claudeの応答が空です。');
  }
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const targetText = codeBlockMatch ? codeBlockMatch[1] : text;

  const start = targetText.indexOf('{');
  const end = targetText.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Claudeの応答からJSONを抽出できませんでした。');
  }
  const jsonStr = targetText.slice(start, end + 1);
  try {
    return JSON.parse(jsonStr);
  } catch (err) {
    // 末尾カンマの自動除去によるフォールバック
    const cleaned = jsonStr.replace(/,\s*([}\]])/g, '$1');
    try {
      return JSON.parse(cleaned);
    } catch {
      throw new Error('Claudeの応答のJSONパースに失敗しました。');
    }
  }
}

export function pickNextTopic(topics, pendingKeywords = new Set()) {
  const candidates = topics
    .map((t, index) => ({ t, index }))
    .filter(({ t }) => !t.done && !pendingKeywords.has(t.keyword.trim()));
  candidates.sort((a, b) => {
    const rankA = PRIORITY_RANK[a.t.priority] ?? 1;
    const rankB = PRIORITY_RANK[b.t.priority] ?? 1;
    if (rankA !== rankB) return rankA - rankB;
    return a.index - b.index;
  });
  return candidates[0] ?? null;
}

export function warnDuplicateKeywords(topics) {
  const seen = new Map();
  for (const t of topics) {
    seen.set(t.keyword, (seen.get(t.keyword) ?? 0) + 1);
  }
  for (const [keyword, count] of seen) {
    if (count > 1) {
      console.warn(`[queue警告] キーワードが重複しています(${count}件): ${keyword}`);
    }
  }
}

export function stripBannedPhrases(body) {
  if (!body || typeof body !== 'string') return '';
  return body
    .split(/\n{2,}/)
    .map((paragraph) => {
      const sentences = paragraph.split('。');
      const kept = sentences.filter(
        (s) => s.trim() === '' || !BANNED_PHRASES.some((phrase) => s.includes(phrase)),
      );
      const hasContent = kept.some((s) => s.trim().length > 0);
      return hasContent ? kept.join('。') : '';
    })
    .filter((paragraph) => paragraph.trim().length > 0)
    .join('\n\n')
    .trim();
}

export function warnDuplicateParagraphs(body) {
  if (!body || typeof body !== 'string') return;
  const paragraphs = body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 20);
  const seen = new Map();
  for (const p of paragraphs) {
    seen.set(p, (seen.get(p) ?? 0) + 1);
  }
  for (const [paragraph, count] of seen) {
    if (count > 1) {
      console.warn(`[品質警告] 同一段落が${count}回繰り返されています。内容は出力しません。`);
    }
  }
}

export function hasMarkdownTable(body) {
  if (!body || typeof body !== 'string') return false;
  const lines = body.split('\n');
  return lines.some((line, i) => {
    const isRow = /^\s*\|?.+\|.+\|?\s*$/.test(line);
    const next = lines[i + 1] ?? '';
    const isSeparator = /^\s*\|?\s*:?-+:?\s*\|\s*:?-+:?\s*\|?.*$/.test(next);
    return isRow && isSeparator;
  });
}

export function validateArticle(article) {
  if (!article || typeof article !== 'object' || Array.isArray(article)) {
    throw new Error('生成された記事はJSONオブジェクトである必要があります。');
  }
  const required = ['title', 'description', 'slug', 'body'];
  for (const key of required) {
    if (typeof article[key] !== 'string' || !article[key].trim()) {
      throw new Error(`生成された記事に必須フィールド "${key}" がありません。`);
    }
  }
  if (article.body.length < 300) {
    throw new Error(`生成された本文が短すぎます(${article.body.length}字)。生成に失敗した可能性があります。`);
  }
  if (!hasMarkdownTable(article.body)) {
    throw new Error('生成された本文に比較表(Markdownテーブル)が含まれていません。');
  }

  // タグの正規化: 文字列で返された場合のカンマ区切り対応、トリム、空要素除外
  if (typeof article.tags === 'string') {
    article.tags = article.tags.split(/[,、]/).map((t) => t.trim()).filter(Boolean);
  } else if (!Array.isArray(article.tags)) {
    article.tags = [];
  } else {
    article.tags = article.tags.map((t) => String(t).trim()).filter(Boolean);
  }
}

export async function existingSlugs(topics, postsDirectory = path.join(ROOT, 'src', 'content', 'posts')) {
  const fromTopics = topics.map((t) => t.slug).filter(Boolean);
  let fromFiles = [];
  try {
    const files = await readdir(postsDirectory);
    fromFiles = files.filter((f) => f.endsWith('.md')).map((f) => f.slice(0, -3));
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
  return new Set([...fromTopics, ...fromFiles]);
}

export async function main({ root = ROOT, env = process.env, createMessage, now = () => new Date() } = {}) {
  // Public CI logs/artifacts and source branches are never a private review queue.
  if (env.CI || env.GITHUB_ACTIONS) throw new Error('CIでは記事生成を実行できません。非共有のローカル環境で確認してください。');
  if (env.DEBUG === 'true' || process.env.DEBUG === 'true') throw new Error('SDKのDEBUGログを無効にしてから実行してください。');
  if (env.GENERATE_POST_APPROVED !== '1') throw new Error('API利用・費用の承認後に GENERATE_POST_APPROVED=1 を設定してください。');
  const apiKey = env.ANTHROPIC_API_KEY;
  if (!apiKey?.trim()) throw new Error('ANTHROPIC_API_KEY が設定されていません。');
  const model = env.GENERATE_POST_MODEL ?? DEFAULT_MODEL;
  const topicsPath = path.join(root, 'data', 'topics.json');
  const topics = JSON.parse(await readFile(topicsPath, 'utf-8'));
  if (!Array.isArray(topics) || topics.some((t) => !t || typeof t.keyword !== 'string' || !t.keyword.trim() ||
      !Array.isArray(t.tags) || t.tags.some((tag) => typeof tag !== 'string'))) {
    throw new Error('トピックキューの構造が不正です。');
  }
  warnDuplicateKeywords(topics);
  const directory = await openPrivateDraftDirectory(root, env.PRIVATE_DRAFTS_DIR);
  return withDraftLock(directory, async () => {
  const pending = await readPendingDrafts(directory);
  const next = pickNextTopic(topics, new Set(pending.map((draft) => draft.keyword.trim())));
  if (!next) {
    console.log('生成可能な未処理トピックがありません。確認待ちの下書きは再生成しません。');
    return { status: 'no_topic' };
  }
  const { t: topic, index: nextIndex } = next;
  if (!createMessage) {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey, authToken: null, baseURL: 'https://api.anthropic.com', maxRetries: 0, timeout: 60_000 });
    createMessage = (request) => client.messages.create(request);
  }

  const systemPrompt = `あなたはガジェット・AIツール比較サイト「ガジェット比較ラボ」のライターです。
SEOを意識した日本語のブログ記事をMarkdownで書きます。
守るべきルール:
- 実在しない製品名・型番・具体的な価格・具体的な計測数値は書かない(不確かな事実の断定を避け、一般的な選び方・比較の観点で書く)
- 誇大表現やあおり文句を避け、読者にとって実用的な内容にする
- 冒頭で「この記事はこんな人向け」という対象読者を1文で明確にする
- 見出し(##)を使い、比較表(Markdownテーブル)を最低1つ含める。比較表の列は記事全体で一貫した基準にする
- 良い点・注意点(メリット/デメリット)を箇条書きで明確に分けて書く
- 「いかがでしたか」等の定型的な締め文句は使わない
- 文字数は800〜1400字程度
- 出力は必ず以下のJSON形式のみ。前後に説明文やコードフェンスを付けない。
{
  "title": "記事タイトル(32文字以内目安)",
  "description": "meta description(80文字以内)",
  "slug": "url-safe-english-slug (半角英数字とハイフンのみ)",
  "tags": ["タグ1", "タグ2"],
  "body": "Markdown本文(見出し・比較表を含む)"
}`;

  const userPrompt = `キーワード: ${topic.keyword}
参考タグ候補: ${(topic.tags ?? []).join(', ')}

このキーワードで検索するユーザー向けの比較・選び方記事を書いてください。`;

  let response;
  try { response = await createMessage({
    model,
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  }); } catch {
    throw new Error('記事生成APIが失敗しました。内容や認証情報をログに出さず停止しました。');
  }
  if (response?.stop_reason !== 'end_turn' || !Array.isArray(response.content)) {
    throw new Error('記事生成が正常に完了していません。下書きを保存せず停止しました。');
  }

  const text = response.content
    .filter((block) => block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text)
    .join('\n');

  const article = extractJson(text);
  validateArticle(article);

  article.body = stripBannedPhrases(article.body);
  validateArticle(article); // Cleanup can remove the entire body/table. Revalidate before saving.
  warnDuplicateParagraphs(article.body);
  if (!article.tags.length) article.tags = topic.tags.map((tag) => tag.trim()).filter(Boolean);

  const used = await existingSlugs(topics, path.join(root, 'src', 'content', 'posts'));
  for (const draft of pending) used.add(draft.slug);
  const slug = resolveSlug(article, topic, nextIndex, used);
  const generatedAt = now().toISOString();

  const frontmatter = [
    '---',
    `title: ${JSON.stringify(article.title)}`,
    `description: ${JSON.stringify(article.description)}`,
    `pubDate: ${generatedAt.slice(0, 10)}`,
    `keyword: ${JSON.stringify(topic.keyword)}`,
    `tags: ${JSON.stringify(article.tags ?? topic.tags ?? [])}`,
    'draft: true',
    'reviewStatus: needs_review',
    '---',
    '',
  ].join('\n');

  const filePath = await saveDraft(directory, {
    keyword: topic.keyword, slug, generatedAt, model,
    markdown: frontmatter + article.body + '\n',
  });
  // Do not write src/content/posts or data/topics.json. Generation is not approval.
  console.log('下書きを非共有の保存先に作成しました。公開・キュー完了は行っていません。');
  return { status: 'needs_review', filePath, slug };
  });
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((err) => {
    console.error('生成を停止しました。設定・保存先・API状態を確認してください。内容はログに出力しません。');
    process.exitCode = 1;
  });
}
