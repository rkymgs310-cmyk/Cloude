#!/usr/bin/env node
// キーワードキュー(data/topics.json)から未処理のトピックを1件取り出し、
// Claude APIで記事を生成してsrc/content/posts/に保存するスクリプト。
// 使い方: ANTHROPIC_API_KEY=xxx node scripts/generate-post.mjs

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import Anthropic from '@anthropic-ai/sdk';

const ROOT = path.resolve(import.meta.dirname, '..');
const TOPICS_PATH = path.join(ROOT, 'data', 'topics.json');
const POSTS_DIR = path.join(ROOT, 'src', 'content', 'posts');
const MODEL = process.env.GENERATE_POST_MODEL ?? 'claude-haiku-4-5-20251001';

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

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY が設定されていません。');
  }

  const topics = JSON.parse(await readFile(TOPICS_PATH, 'utf-8'));
  const nextIndex = topics.findIndex((t) => !t.done);
  if (nextIndex === -1) {
    console.log('未処理のトピックがありません。data/topics.json に追加してください。');
    return;
  }
  const topic = topics[nextIndex];

  const client = new Anthropic({ apiKey });

  const systemPrompt = `あなたはガジェット・AIツール比較サイト「ガジェット比較ラボ」のライターです。
SEOを意識した日本語のブログ記事をMarkdownで書きます。
守るべきルール:
- 実在しない製品名・型番・具体的な価格・具体的な計測数値は書かない(不確かな事実の断定を避け、一般的な選び方・比較の観点で書く)
- 誇大表現やあおり文句を避け、読者にとって実用的な内容にする
- 見出し(##)を使い、比較表(Markdownテーブル)を最低1つ含める
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
  const slug = slugify(article.slug || article.title || topic.keyword);
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
