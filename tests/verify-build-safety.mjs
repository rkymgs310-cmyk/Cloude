// Real Astro builds with synthetic fixtures only. No model calls or publication.
import assert from 'node:assert/strict';
import { mkdtemp, cp, symlink, writeFile, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const temporary = await mkdtemp(path.join(tmpdir(), 'cloude-build-safety-'));
const fixture = (marker, flags = '') => `---\ntitle: "${marker}"\ndescription: "${marker}"\npubDate: 2026-10-01\nkeyword: "${marker}"\ntags: ["${marker}"]\n${flags}---\n\n${marker}\n`;
async function files(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await files(full)); else result.push(full);
  }
  return result;
}
function build() {
  return spawnSync(process.execPath, [path.join(root, 'node_modules/astro/astro.js'), 'build'], {
    cwd: temporary, encoding: 'utf8', env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1' },
  });
}

try {
  for (const item of ['src', 'public', 'astro.config.mjs', 'tsconfig.json', 'package.json']) {
    await cp(path.join(root, item), path.join(temporary, item), { recursive: true });
  }
  await symlink(path.join(root, 'node_modules'), path.join(temporary, 'node_modules'), 'dir');
  const posts = path.join(temporary, 'src/content/posts');
  await writeFile(path.join(posts, 'hidden-review.md'), fixture('HIDDEN_REVIEW_MARKER', 'draft: true\nreviewStatus: needs_review\n'));
  await writeFile(path.join(posts, 'missing-draft.md'), fixture('DEFAULT_DRAFT_MARKER'));
  const hostile = 'Safe </script><script>BAD</script> & ]]>';
  const hostileFrontmatter = `---\ntitle: ${JSON.stringify(hostile)}\ndescription: ${JSON.stringify(hostile)}\npubDate: 2026-10-01\nkeyword: safe-test\ntags: [${JSON.stringify('A & <B> ]]>')}]\ndraft: false\nreviewStatus: approved\n---\n\nSynthetic review fixture\n`;
  await writeFile(path.join(posts, 'escape-test.md'), hostileFrontmatter);
  const built = build();
  assert.equal(built.status, 0, built.stdout + built.stderr);
  const outputs = await files(path.join(temporary, 'dist'));
  const contents = (await Promise.all(outputs.map((file) => readFile(file, 'utf8')))).join('\n');
  for (const marker of ['HIDDEN_REVIEW_MARKER', 'DEFAULT_DRAFT_MARKER', 'hidden-review', 'missing-draft']) {
    assert.ok(!contents.includes(marker), `Unreviewed content leaked: ${marker}`);
    assert.ok(outputs.every((file) => !file.includes(marker)), `Unreviewed route leaked: ${marker}`);
  }
  for (const slug of ['smart-plug-guide', 'power-bank-buying-guide', 'ai-image-generation-commercial-use', 'best-ai-note-taking-apps-2026']) {
    assert.ok(outputs.some((file) => file.endsWith(`/posts/${slug}/index.html`)), `Existing article lost: ${slug}`);
  }
  const html = await readFile(path.join(temporary, 'dist/posts/escape-test/index.html'), 'utf8');
  const jsonLd = html.match(/type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/);
  assert.ok(jsonLd, 'JSON-LD missing');
  const parsed = JSON.parse(jsonLd[1]);
  assert.equal(parsed['@graph'][0].headline, hostile);
  const rss = await readFile(path.join(temporary, 'dist/rss.xml'), 'utf8');
  assert.ok(rss.includes('A &amp; &lt;B&gt; ]]&gt;'));
  assert.ok(!rss.includes('<script>BAD</script>'));
  console.log('PASS: JSON-LD and RSS safely encode synthetic untrusted text.');
  console.log('PASS: private/default drafts absent from articles, homepage, tags, related articles, RSS, and sitemap; 4 existing articles retained.');

  await writeFile(path.join(posts, 'hidden-review.md'), fixture('HIDDEN_REVIEW_MARKER', 'draft: false\nreviewStatus: needs_review\n'));
  const invalid = build();
  assert.notEqual(invalid.status, 0, 'needs_review + draft:false must fail the build');
  assert.match(invalid.stdout + invalid.stderr, /確認待ちの記事/);
  console.log('PASS: changing only draft:false on a needs_review article fails the build.');
} finally {
  await rm(temporary, { recursive: true, force: true });
}
