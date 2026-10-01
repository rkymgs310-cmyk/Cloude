import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm, stat, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { main, extractJson, warnDuplicateParagraphs } from '../scripts/generate-post.mjs';
import { openPrivateDraftDirectory, saveDraft, topicId, withDraftLock } from '../scripts/private-drafts.mjs';

const BODY = '## 比較\n\n| 項目 | 選び方 |\n| --- | --- |\n| 用途 | 自分の条件と照合 |\n\n' + 'これはネットワークを使わない架空のテスト本文です。'.repeat(25);
const ARTICLE = { title: 'TEST_ONLY', description: 'テスト専用', slug: 'test-only', tags: [], body: BODY, draft: false, status: 'approved' };
const response = (article = ARTICLE) => ({ stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(article) }] });

async function fixture(t, topics = [{ keyword: 'テスト', tags: ['テストタグ'] }]) {
  const temporary = await mkdtemp(path.join(tmpdir(), 'cloude-test-'));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  const root = path.join(temporary, 'repo');
  await mkdir(path.join(root, 'data'), { recursive: true });
  await mkdir(path.join(root, 'src/content/posts'), { recursive: true });
  await writeFile(path.join(root, 'data/topics.json'), JSON.stringify(topics));
  await writeFile(path.join(root, 'src/content/posts/existing.md'), 'unchanged existing article');
  const directory = path.join(temporary, 'private');
  const env = { ANTHROPIC_API_KEY: 'fake-test-value-not-a-key', GENERATE_POST_APPROVED: '1', PRIVATE_DRAFTS_DIR: directory };
  let calls = 0;
  return { root, directory, env, calls: () => calls, createMessage: async () => { calls++; return response(); } };
}

async function assertUnchanged(f) {
  assert.equal(await readFile(path.join(f.root, 'src/content/posts/existing.md'), 'utf8'), 'unchanged existing article');
  assert.deepEqual(await readdir(path.join(f.root, 'src/content/posts')), ['existing.md']);
  const topics = JSON.parse(await readFile(path.join(f.root, 'data/topics.json'), 'utf8'));
  assert.ok(topics.every((topic) => !topic.done && !topic.generatedAt && !topic.slug));
}

describe('private review boundary (stubbed, no API calls)', () => {
  it('saves one private needs_review bundle, preserving posts and queue bytes', async (t) => {
    const f = await fixture(t);
    const before = await readFile(path.join(f.root, 'data/topics.json'));
    const result = await main(f);
    const draft = JSON.parse(await readFile(result.filePath, 'utf8'));
    assert.equal(f.calls(), 1);
    assert.equal(draft.status, 'needs_review');
    assert.match(draft.markdown, /\ndraft: true\nreviewStatus: needs_review\n/);
    assert.match(draft.markdown, /tags: \["テストタグ"\]/);
    assert.ok(!result.filePath.startsWith(f.root + path.sep));
    assert.deepEqual(await readFile(path.join(f.root, 'data/topics.json')), before);
    await assertUnchanged(f);
    if (process.platform !== 'win32') {
      assert.equal((await stat(f.directory)).mode & 0o777, 0o700);
      assert.equal((await stat(result.filePath)).mode & 0o777, 0o600);
    }
  });

  for (const flag of ['CI', 'GITHUB_ACTIONS']) it(`rejects ${flag} before API despite all consent flags`, async (t) => {
    const f = await fixture(t); f.env[flag] = 'true';
    await assert.rejects(main(f), /CIでは/); assert.equal(f.calls(), 0); await assertUnchanged(f);
  });

  it('rejects both injected and ambient SDK debug logging', async (t) => {
    const f = await fixture(t); f.env.DEBUG = 'true';
    await assert.rejects(main(f), /DEBUG/); delete f.env.DEBUG;
    const previous = process.env.DEBUG; process.env.DEBUG = 'true';
    try { await assert.rejects(main(f), /DEBUG/); }
    finally { if (previous === undefined) delete process.env.DEBUG; else process.env.DEBUG = previous; }
    assert.equal(f.calls(), 0);
  });

  for (const missing of ['ANTHROPIC_API_KEY', 'GENERATE_POST_APPROVED', 'PRIVATE_DRAFTS_DIR']) it(`rejects missing ${missing} before API`, async (t) => {
    const f = await fixture(t); delete f.env[missing];
    await assert.rejects(main(f)); assert.equal(f.calls(), 0); await assertUnchanged(f);
  });

  it('skips pending drafts without repeat charges and deduplicates slugs across drafts', async (t) => {
    const f = await fixture(t, [{ keyword: 'one', tags: [] }, { keyword: 'two', tags: [] }]);
    const one = await main(f), two = await main(f), three = await main(f);
    assert.equal(f.calls(), 2); assert.equal(two.slug, one.slug + '-2'); assert.equal(three.status, 'no_topic');
    await assertUnchanged(f);
  });

  it('rejects repository root, subdirectory, traversal, and symlink destinations', async (t) => {
    const f = await fixture(t);
    const alias = path.join(path.dirname(f.root), 'alias'); await symlink(f.root, alias, 'dir');
    for (const target of [f.root, path.join(f.root, 'drafts'), path.join(f.directory, '..', 'repo', 'drafts'), alias, path.join(alias, 'drafts')]) {
      await assert.rejects(openPrivateDraftDirectory(f.root, target), /リポジトリ|シンボリック/);
    }
    assert.equal(f.calls(), 0);
  });

  it('rejects a different Git working tree', async (t) => {
    const f = await fixture(t); const other = path.join(path.dirname(f.root), 'other-repository');
    await mkdir(path.join(other, '.git'), { recursive: true });
    await writeFile(path.join(other, '.git/HEAD'), 'ref: refs/heads/test');
    f.env.PRIVATE_DRAFTS_DIR = path.join(other, 'drafts');
    await assert.rejects(main(f), /Git/); assert.equal(f.calls(), 0);
  });

  it('rejects a symlink to a different external directory', async (t) => {
    const f = await fixture(t); const target = path.join(path.dirname(f.root), 'other');
    await mkdir(target, { mode: 0o700 }); await symlink(target, f.directory, 'dir');
    await assert.rejects(main(f), /シンボリック/); assert.equal(f.calls(), 0);
  });

  it('rejects non-private permissions before API', { skip: process.platform === 'win32' }, async (t) => {
    const f = await fixture(t); await mkdir(f.directory, { mode: 0o755 });
    await assert.rejects(main(f), /所有者/); assert.equal(f.calls(), 0);
  });

  it('refuses existing locks without API calls', async (t) => {
    const f = await fixture(t); await mkdir(f.directory, { mode: 0o700 });
    await withDraftLock(f.directory, async () => { await assert.rejects(main(f), /ロック/); });
    assert.equal(f.calls(), 0);
  });

  it('never overwrites an existing draft', async (t) => {
    const f = await fixture(t); const result = await main(f); const before = await readFile(result.filePath);
    await assert.rejects(saveDraft(f.directory, { keyword: 'テスト', slug: 'overwrite', markdown: 'changed' }), { code: 'EEXIST' });
    assert.deepEqual(await readFile(result.filePath), before);
  });

  it('fails closed on an incomplete or edited pending bundle before API', async (t) => {
    const f = await fixture(t); await mkdir(f.directory, { mode: 0o700 });
    await writeFile(path.join(f.directory, topicId('テスト') + '.json'), '{"broken":true}', { mode: 0o600 });
    await assert.rejects(main(f), /整合性/); assert.equal(f.calls(), 0); await assertUnchanged(f);
  });

  const invalidResponses = [
    ['truncated response', { ...response(), stop_reason: 'max_tokens' }],
    ['invalid JSON', { stop_reason: 'end_turn', content: [{ type: 'text', text: 'PRIVATE_MODEL_TEXT {invalid}' }] }],
    ['missing field', response({ ...ARTICLE, title: '' })],
    ['whitespace field', response({ ...ARTICLE, title: '   ' })],
    ['post-cleanup invalid body', response({ ...ARTICLE, body: '| A | B |\n| --- | --- |\n\n' + ('いかがでしたか' + 'あ'.repeat(400) + '。') })],
  ];
  for (const [label, result] of invalidResponses) it(`fails closed for ${label}`, async (t) => {
    const f = await fixture(t); f.createMessage = async () => result;
    await assert.rejects(main(f), (error) => { assert.ok(!error.message.includes('PRIVATE_MODEL_TEXT')); return true; });
    assert.deepEqual(await readdir(f.directory), []); await assertUnchanged(f);
  });

  it('redacts provider failures and model parse/warning content', async (t) => {
    const f = await fixture(t); f.createMessage = async () => { throw new Error('PRIVATE_MODEL_TEXT secret-key'); };
    await assert.rejects(main(f), (error) => !/PRIVATE_MODEL_TEXT|secret-key/.test(error.message));
    assert.throws(() => extractJson('PRIVATE_MODEL_TEXT'), (error) => !error.message.includes('PRIVATE_MODEL_TEXT'));
    const messages = []; t.mock.method(console, 'warn', (message) => messages.push(message));
    const paragraph = 'PRIVATE_MODEL_TEXT'.repeat(4); warnDuplicateParagraphs(paragraph + '\n\n' + paragraph);
    assert.ok(messages.length); assert.ok(messages.every((message) => !message.includes('PRIVATE_MODEL_TEXT')));
    await assertUnchanged(f);
  });
});

describe('offline workflow contract', () => {
  for (const name of ['ci.yml', 'generate-post.yml']) it(`${name} has no generation/publication path`, async () => {
    const workflow = await readFile(new URL('../.github/workflows/' + name, import.meta.url), 'utf8');
    assert.match(workflow, /contents: read/); assert.match(workflow, /persist-credentials: false/);
    assert.match(workflow, /npm test/); assert.match(workflow, /npm run build/);
    assert.doesNotMatch(workflow, /contents: write|secrets\.|npm run generate|git (?:add|commit|push)|upload-artifact|deploy-/i);
  });
  it('keeps the original schedule and adds pre-generation offline QA', async () => {
    const workflow = await readFile(new URL('../.github/workflows/generate-post.yml', import.meta.url), 'utf8');
    assert.match(workflow, /cron: "0 12 \* \* \*"/);
    const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
    assert.equal(pkg.scripts['pregenerate:post'], 'npm test && npm run build');
  });
});
