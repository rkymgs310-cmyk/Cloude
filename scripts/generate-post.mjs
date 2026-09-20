#!/usr/bin/env node
// キーワードキュー(data/topics.json)から未処理のトピックを1件取り出し、
// Claude APIで記事を生成してsrc/content/posts/に保存するスクリプト。
// 使い方: ANTHROPIC_API_KEY=xxx node scripts/generate-post.mjs

import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';

const ROOT = path.resolve(import.meta.dirname, '..');
const TOPICS_PATH = path.join(ROOT, 'data', 'topics.json');
const POSTS_DIR = path.join(ROOT, 'src', 'content', 'posts');
const MODEL = process.env.GENERATE_POST_MODEL ?? 'claude-haiku-4-5-20251001';

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
    .slice(0, 60);
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
    throw new Error(`Claudeの応答からJSONを抽出できませんでした:\n${text}`);
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
      throw new Error(`Claudeの応答のJSONパースに失敗しました (${err.message}):\n${jsonStr}`);
    }
  }
}

export function pickNextTopic(topics) {
  const candidates = topics
    .map((t, index) => ({ t, index }))
    .filter(({ t }) => !t.done);
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
      console.warn(`[品質警告] 同一段落が${count}回繰り返されています: ${paragraph.slice(0, 40)}...`);
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
  const required = ['title', 'description', 'slug', 'body'];
  for (const key of required) {
    if (!article[key] || typeof article[key] !== 'string') {
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

export async function existingSlugs(topics) {
  const fromTopics = topics.map((t) => t.slug).filter(Boolean);
  let fromFiles = [];
  try {
    const files = await readdir(POSTS_DIR);
    fromFiles = files.filter((f) => f.endsWith('.md')).map((f) => f.slice(0, -3));
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
  return new Set([...fromTopics, ...fromFiles]);
}

export async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY が設定されていません。');
  }

  const topics = JSON.parse(await readFile(TOPICS_PATH, 'utf-8'));
  warnDuplicateKeywords(topics);

  const next = pickNextTopic(topics);
  if (!next) {
    console.log('未処理のトピックがありません。data/topics.json に追加してください。');
    return;
  }
  const { t: topic, index: nextIndex } = next;

  const client = new Anthropic({ apiKey });

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

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const text = response.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n');

  const article = extractJson(text);
  validateArticle(article);

  article.body = stripBannedPhrases(article.body);
  warnDuplicateParagraphs(article.body);

  const used = await existingSlugs(topics);
  const slug = resolveSlug(article, topic, nextIndex, used);
  const filePath = path.join(POSTS_DIR, `${slug}.md`);

  const frontmatter = [
    '---',
    `title: ${JSON.stringify(article.title)}`,
    `description: ${JSON.stringify(article.description)}`,
    `pubDate: ${new Date().toISOString().slice(0, 10)}`,
    `keyword: ${JSON.stringify(topic.keyword)}`,
    `tags: ${JSON.stringify(article.tags ?? topic.tags ?? [])}`,
    'draft: false',
    '---',
    '',
  ].join('\n');

  await mkdir(POSTS_DIR, { recursive: true });
  await writeFile(filePath, frontmatter + article.body + '\n', 'utf-8');

  topics[nextIndex] = { ...topic, done: true, slug, generatedAt: new Date().toISOString() };
  await writeFile(TOPICS_PATH, JSON.stringify(topics, null, 2) + '\n', 'utf-8');

  console.log(`記事を生成しました: ${filePath}`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
