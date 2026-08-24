import { readFile, writeFile, rename } from 'node:fs/promises';
import { validateFeatured } from './catalog.mjs';

const { repository } = JSON.parse(await readFile(new URL('../data/source.json', import.meta.url), 'utf8'));
if (!/^[\w.-]+\/[\w.-]+$/.test(repository)) throw new Error('Invalid configured repository.');
const api = 'https://api.github.com/repos/' + repository;
const headers = {
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2026-03-10',
  ...(process.env.GITHUB_TOKEN ? { Authorization: 'Bearer ' + process.env.GITHUB_TOKEN } : {})
};

async function request(url, options = {}, format = 'json') {
  const response = await fetch(url, {
    ...options,
    headers: { 'User-Agent': 'DeisDevSite (https://github.com/DeisDev)', ...options.headers },
    signal: AbortSignal.timeout(30_000)
  });
  if (!response.ok) throw new Error(new URL(url).hostname + ' returned HTTP ' + response.status + '; saved data was not replaced.');
  return format === 'text' ? response.text() : response.json();
}

const [repo, release, readme, readmeHtml, steam] = await Promise.all([
  request(api, { headers }),
  request(api + '/releases/latest', { headers }),
  request(api + '/readme', { headers }),
  request(api + '/readme', { headers: { ...headers, Accept: 'application/vnd.github.html+json' } }, 'text'),
  request('https://api.steampowered.com/ISteamRemoteStorage/GetPublishedFileDetails/v1/', {
    method: 'POST',
    body: new URLSearchParams({ itemcount: '1', 'publishedfileids[0]': '3597784225' })
  })
]);
const addon = steam.response?.publishedfiledetails?.find((item) => item.publishedfileid === '3597784225');
if (!addon || addon.result !== 1 || addon.consumer_app_id !== 4000) throw new Error('Better Lights Workshop metadata is unavailable.');
if (release.draft !== false || release.prerelease !== false || !Array.isArray(release.assets)) throw new Error('Expected a published stable release.');
const data = {
  subscribers: addon.subscriptions,
  repository: repo.full_name,
  name: repo.name,
  description: repo.description ?? '',
  repoUrl: repo.html_url,
  hasIssues: repo.has_issues,
  readmeUrl: readme.html_url,
  readmeRawUrl: readme.download_url,
  readmeHtml,
  version: release.tag_name,
  releaseUrl: release.html_url,
  downloads: release.assets.filter((asset) => asset.state === 'uploaded')
    .map((asset) => ({ name: asset.label || asset.name, url: asset.browser_download_url }))
};
validateFeatured(data);
// Publish a new snapshot only when every required source has succeeded.
const path = new URL('../data/projects.json', import.meta.url);
const temporary = new URL('../data/projects.json.tmp', import.meta.url);
await writeFile(temporary, JSON.stringify(data, null, 2) + '\n');
await rename(temporary, path);
console.log('Updated repository metadata, README, release downloads, and Better Lights subscribers.');
