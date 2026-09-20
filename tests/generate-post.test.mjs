import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  slugify,
  dedupeSlug,
  resolveSlug,
  extractJson,
  pickNextTopic,
  warnDuplicateKeywords,
  stripBannedPhrases,
  hasMarkdownTable,
  validateArticle,
  BANNED_PHRASES,
} from '../scripts/generate-post.mjs';

describe('slugify', () => {
  it('converts uppercase and special characters to lowercase-hyphenated', () => {
    assert.equal(slugify('Smart Plug 2026: Best Review!'), 'smart-plug-2026-best-review');
  });

  it('trims leading and trailing hyphens', () => {
    assert.equal(slugify('---hello--world---'), 'hello-world');
  });

  it('truncates to 60 characters', () => {
    const long = 'a'.repeat(100);
    assert.equal(slugify(long).length, 60);
  });

  it('returns empty string for non-ASCII or empty input', () => {
    assert.equal(slugify('スマート家電 おすすめ'), '');
    assert.equal(slugify(''), '');
    assert.equal(slugify(null), '');
  });
});

describe('dedupeSlug', () => {
  it('returns original slug when not used', () => {
    const used = new Set(['post-1', 'post-2']);
    assert.equal(dedupeSlug('post-3', used), 'post-3');
  });

  it('appends -2 when slug already exists', () => {
    const used = new Set(['smart-plug']);
    assert.equal(dedupeSlug('smart-plug', used), 'smart-plug-2');
  });

  it('increments suffix until unique', () => {
    const used = new Set(['smart-plug', 'smart-plug-2', 'smart-plug-3']);
    assert.equal(dedupeSlug('smart-plug', used), 'smart-plug-4');
  });
});

describe('resolveSlug', () => {
  it('prefers article.slug when valid ASCII slug is present', () => {
    const article = { slug: 'ai-notes-guide', title: 'AIノートの選び方' };
    const topic = { keyword: 'AI ノート 比較' };
    assert.equal(resolveSlug(article, topic, 0, new Set()), 'ai-notes-guide');
  });

  it('falls back to slugified article.title if article.slug is non-ASCII', () => {
    const article = { slug: '日本語スラッグ', title: 'Best AI Tools 2026' };
    const topic = { keyword: 'AI ツール' };
    assert.equal(resolveSlug(article, topic, 0, new Set()), 'best-ai-tools-2026');
  });

  it('falls back to topic.keyword if title and slug are non-ASCII', () => {
    const article = { slug: '日本語', title: '日本語タイトル' };
    const topic = { keyword: 'Power Bank 10000mAh' };
    assert.equal(resolveSlug(article, topic, 0, new Set()), 'power-bank-10000mah');
  });

  it('falls back to post-{index} when all candidates are non-ASCII', () => {
    const article = { slug: '日本語スラッグ', title: 'スマートプラグのおすすめ' };
    const topic = { keyword: 'スマートプラグ 選び方' };
    assert.equal(resolveSlug(article, topic, 2, new Set()), 'post-3');
  });

  it('dedupes fallback slugs if already used', () => {
    const article = { slug: '', title: '' };
    const topic = { keyword: 'ロボット掃除機' };
    const used = new Set(['post-1']);
    assert.equal(resolveSlug(article, topic, 0, used), 'post-1-2');
  });
});

describe('extractJson', () => {
  it('parses pure JSON string', () => {
    const input = '{"title":"Test","description":"Desc","slug":"test","body":"Body"}';
    assert.deepEqual(extractJson(input), {
      title: 'Test',
      description: 'Desc',
      slug: 'test',
      body: 'Body',
    });
  });

  it('extracts JSON surrounded by markdown code block', () => {
    const input = 'Here is the generated article:\n```json\n{"title":"Test","body":"Content"}\n```\nDone!';
    assert.deepEqual(extractJson(input), {
      title: 'Test',
      body: 'Content',
    });
  });

  it('recovers from trailing commas before closing braces', () => {
    const input = '{\n  "title": "Test",\n  "tags": ["A", "B",],\n}';
    assert.deepEqual(extractJson(input), {
      title: 'Test',
      tags: ['A', 'B'],
    });
  });

  it('throws error when no JSON object is present', () => {
    assert.throws(() => extractJson('This is not json at all.'), /Claudeの応答からJSONを抽出できませんでした/);
    assert.throws(() => extractJson(''), /Claudeの応答が空です/);
  });
});

describe('pickNextTopic', () => {
  it('skips topics already marked done', () => {
    const topics = [
      { keyword: 'Topic 1', done: true },
      { keyword: 'Topic 2', done: false },
    ];
    const next = pickNextTopic(topics);
    assert.equal(next?.t.keyword, 'Topic 2');
    assert.equal(next?.index, 1);
  });

  it('prioritizes high priority over normal and low priority', () => {
    const topics = [
      { keyword: 'Low Topic', priority: 'low' },
      { keyword: 'Normal Topic' },
      { keyword: 'High Topic', priority: 'high' },
    ];
    const next = pickNextTopic(topics);
    assert.equal(next?.t.keyword, 'High Topic');
    assert.equal(next?.index, 2);
  });

  it('maintains original queue order when priorities are equal', () => {
    const topics = [
      { keyword: 'High Topic 1', priority: 'high' },
      { keyword: 'High Topic 2', priority: 'high' },
    ];
    const next = pickNextTopic(topics);
    assert.equal(next?.t.keyword, 'High Topic 1');
    assert.equal(next?.index, 0);
  });

  it('returns null when all topics are done', () => {
    const topics = [
      { keyword: 'Topic 1', done: true },
      { keyword: 'Topic 2', done: true },
    ];
    assert.equal(pickNextTopic(topics), null);
  });
});

describe('stripBannedPhrases', () => {
  it('removes banned phrases from a sentence', () => {
    const input = 'おすすめの機能を紹介します。いかがでしたでしょうか。ぜひ試してみてください。';
    const result = stripBannedPhrases(input);
    assert.equal(result, 'おすすめの機能を紹介します。ぜひ試してみてください。');
  });

  it('filters out paragraphs that only consist of banned phrases', () => {
    const input = '第1段落です。\n\n本記事が少しでも参考になれば幸いです。\n\n第3段落です。';
    const result = stripBannedPhrases(input);
    assert.equal(result, '第1段落です。\n\n第3段落です。');
  });

  it('handles all defined BANNED_PHRASES', () => {
    for (const phrase of BANNED_PHRASES) {
      const input = `本文のテストです。${phrase}。おわり。`;
      const result = stripBannedPhrases(input);
      assert.ok(!result.includes(phrase), `Failed to strip phrase: ${phrase}`);
    }
  });
});

describe('hasMarkdownTable', () => {
  it('detects standard markdown table', () => {
    const body = `
## 比較
| 製品名 | 価格 | 特徴 |
| --- | --- | --- |
| モデルA | ¥3,000 | 軽量 |
| モデルB | ¥5,000 | 高性能 |
    `;
    assert.equal(hasMarkdownTable(body), true);
  });

  it('detects table with alignment colons', () => {
    const body = `
| 項目 | 値 |
| :--- | :---: |
| A | 1 |
    `;
    assert.equal(hasMarkdownTable(body), true);
  });

  it('detects table without outer border pipes', () => {
    const body = `
項目 | 値
--- | ---
A | 1
    `;
    assert.equal(hasMarkdownTable(body), true);
  });

  it('returns false for text without tables', () => {
    const body = 'これは普通の文章です。\n- リスト項目1\n- リスト項目2';
    assert.equal(hasMarkdownTable(body), false);
  });
});

describe('validateArticle', () => {
  const validArticle = {
    title: 'スマートプラグの選び方',
    description: 'スマートプラグの選び方を徹底比較。',
    slug: 'smart-plug-guide',
    tags: ['スマート家電'],
    body: '## 比較\n\n| 製品 | 価格 |\n| --- | --- |\n| A | 100 |\n\n' + 'あ'.repeat(300),
  };

  it('accepts valid article', () => {
    const copy = { ...validArticle };
    assert.doesNotThrow(() => validateArticle(copy));
    assert.deepEqual(copy.tags, ['スマート家電']);
  });

  it('normalizes string tags into array of strings', () => {
    const copy = { ...validArticle, tags: 'スマート家電, 便利グッズ , AI ' };
    validateArticle(copy);
    assert.deepEqual(copy.tags, ['スマート家電', '便利グッズ', 'AI']);
  });

  it('throws error when required field is missing', () => {
    const copy = { ...validArticle };
    delete copy.title;
    assert.throws(() => validateArticle(copy), /必須フィールド "title" がありません/);
  });

  it('throws error when body is too short', () => {
    const copy = {
      ...validArticle,
      body: '| A | B |\n| --- | --- |\n短すぎる本文',
    };
    assert.throws(() => validateArticle(copy), /生成された本文が短すぎます/);
  });

  it('throws error when markdown table is absent', () => {
    const copy = {
      ...validArticle,
      body: 'あ'.repeat(400),
    };
    assert.throws(() => validateArticle(copy), /比較表\(Markdownテーブル\)が含まれていません/);
  });
});
