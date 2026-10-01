// Local-only review storage. Never import this directory into Astro or upload it.
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, lstat, realpath, readdir, readFile, open, link, unlink } from 'node:fs/promises';
import path from 'node:path';

export function topicId(keyword) {
  return createHash('sha256').update(keyword.trim()).digest('hex');
}

function inside(parent, child) {
  const relative = path.relative(parent, child);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

export async function privateDraftDirectory(root, requested) {
  if (!requested || !path.isAbsolute(requested)) {
    throw new Error('PRIVATE_DRAFTS_DIR にリポジトリ外の非共有・絶対パスを指定してください。');
  }
  const repository = await realpath(root);
  const directory = path.resolve(requested);
  if (inside(repository, directory)) throw new Error('下書きはリポジトリ外に保存してください。');
  // Only the final directory may be created; require an existing, private parent.
  const parent = await realpath(path.dirname(directory));
  if (inside(repository, parent)) throw new Error('下書き保存先がリポジトリ内を指しています。');
  for (let ancestor = parent;; ancestor = path.dirname(ancestor)) {
    try {
      const git = path.join(ancestor, '.git');
      const info = await lstat(git);
      if (info.isDirectory()) await lstat(path.join(git, 'HEAD'));
      throw new Error('下書き保存先は別のGit作業ツリーにも置けません。');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    if (path.dirname(ancestor) === ancestor) break;
  }
  const resolved = path.join(parent, path.basename(directory));
  await mkdir(resolved, { mode: 0o700 });
  return resolved;
}

export async function openPrivateDraftDirectory(root, requested) {
  let directory;
  try {
    directory = await privateDraftDirectory(root, requested);
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    directory = path.resolve(requested);
  }
  try {
    const git = path.join(directory, '.git');
    const info = await lstat(git);
    if (info.isDirectory()) await lstat(path.join(git, 'HEAD'));
    throw new Error('下書き保存先はGit作業ツリーにできません。');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const info = await lstat(directory);
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('下書き保存先にシンボリックリンクは使えません。');
  directory = await realpath(directory);
  if (inside(await realpath(root), directory)) throw new Error('下書き保存先がリポジトリ内を指しています。');
  if (process.platform !== 'win32' && (info.mode & 0o077) !== 0) {
    throw new Error('下書き保存先は所有者だけが読み書きできるディレクトリにしてください。');
  }
  return directory;
}

export async function readPendingDrafts(directory) {
  const pending = [];
  for (const file of await readdir(directory)) {
    if (!file.endsWith('.json')) continue;
    const fullPath = path.join(directory, file);
    const info = await lstat(fullPath);
    if (!info.isFile() || info.isSymbolicLink()) throw new Error('不正な下書きファイルを検出しました。');
    let draft;
    try { draft = JSON.parse(await readFile(fullPath, 'utf8')); }
    catch { throw new Error('下書きファイルを読み取れません。上書きせず停止しました。'); }
    if (draft.version !== 1 || draft.status !== 'needs_review' ||
        typeof draft.keyword !== 'string' || !draft.keyword.trim() ||
        file !== `${topicId(draft.keyword)}.json` ||
        typeof draft.slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(draft.slug) ||
        typeof draft.markdown !== 'string' ||
        draft.sha256 !== createHash('sha256').update(draft.markdown).digest('hex')) {
      throw new Error('下書きの状態または整合性が不正です。確認するまで生成を停止します。');
    }
    pending.push(draft);
  }
  return pending;
}

export async function withDraftLock(directory, action) {
  const lockPath = path.join(directory, '.generation.lock');
  let lock;
  try { lock = await open(lockPath, 'wx', 0o600); }
  catch { throw new Error('別の生成処理または未回復のロックがあります。確認するまで停止します。'); }
  try { return await action(); }
  finally { await lock.close(); await unlink(lockPath); }
}

export async function saveDraft(directory, { keyword, slug, markdown, generatedAt, model }) {
  const draft = {
    version: 1, status: 'needs_review', keyword, slug, generatedAt, model,
    sha256: createHash('sha256').update(markdown).digest('hex'), markdown,
  };
  const target = path.join(directory, `${topicId(keyword)}.json`);
  const temporary = path.join(directory, `.tmp-${randomUUID()}`);
  const file = await open(temporary, 'wx', 0o600);
  try {
    await file.writeFile(JSON.stringify(draft, null, 2) + '\n', 'utf8');
    await file.sync();
    await file.close();
    // Atomic, no-clobber creation: a failed write never replaces an older draft.
    await link(temporary, target);
  } finally {
    await file.close();
    await unlink(temporary);
  }
  return target;
}
