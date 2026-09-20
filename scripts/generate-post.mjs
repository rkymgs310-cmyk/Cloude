#!/usr/bin/env node
// キーワードキュー(data/topics.json)から未処理のトピックを1件取り出し、
// Claude APIで記事を生成してsrc/content/posts/に保存するスクリプト。
// 使い方: ANTHROPIC_API_KEY=xxx node scripts/generate-post.mjs

import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import Anthropic from '@anthropic-ai/sdk';

const ROOT = path.resolve(import.meta.dirname, '..');
const TOPICS_PATH = path.join(ROOT, 'data', 'topics.json');
const POSTS_DIR = path.join(ROOT, 'src', 'content', 'posts');
const MODEL = process.env.GENERATE_POST_MODEL ?? 'claude-haiku-4-5-20251001';

// 生成AIが書きがちな定型の締め文句。含む文をまるごと除去する。
const BANNED_PHRASES = [
  'いかがでしたか',
  'いかがでしたでしょうか',
  '本記事が少しでも参考になれば幸いです',
  'この記事が少しでもお役に立てば嬉しいです',
  '最後までお読みいただきありがとうございました',
];

const PRIORITY_RANK = { high: 0, 高: 0, mid: 1, normal: 1, low: 2, 低: 2 };

function slugify(input) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function extractJson(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) {
    throw new Error(`Claudeの応答からJSONを抽出できませんでした:\n${text}`);
  }
  return JSON.parse(text.slice(start, end + 1));
}

function pickNextTopic(topics) {
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

function warnDuplicateKeywords(topics) {
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

function stripBannedPhrases(body) {
  return body
    .split(/\n{2,}/)
    .map((paragraph) => {
      const sentences = paragraph.split('。');
      const kept = sentences.filter(
        (s) => !BANNED_PHRASES.some((phrase) => s.includes(phrase)),
      );
      return kept.join('。');
    })
    .join('\n\n')
    .replace(/\n{3,}/g, '\n\n');
}

function warnDuplicateParagraphs(body) {
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

function hasMarkdownTable(body) {
  const lines = body.split('\n');
  return lines.some((line, i) => {
    const isRow = /^\s*\|.*\|\s*$/.test(line);
    const next = lines[i + 1] ?? '';
    const isSeparator = /^\s*\|?[\s:|-]+\|[\s:|-]+\|?\s*$/.test(next);
    return isRow && isSeparator;
  });
}

function validateArticle(article) {
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
}

async function existingSlugs(topics) {
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

function dedupeSlug(baseSlug, used) {
  if (!used.has(baseSlug)) return baseSlug;
  let n = 2;
  while (used.has(`${baseSlug}-${n}`)) n += 1;
  return `${baseSlug}-${n}`;
}

async function main() {
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
  "slug": "url-safe-english-slug",
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
  const baseSlug = slugify(article.slug || article.title || topic.keyword);
  const slug = dedupeSlug(baseSlug, used);
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

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
