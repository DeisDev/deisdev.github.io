import { readFile, writeFile, rename } from 'node:fs/promises';

const source = JSON.parse(await readFile(new URL('../data/source.json', import.meta.url), 'utf8'));
const { githubUsername, workshopId, repository } = source;
if (typeof githubUsername !== 'string' || !/^[\w-]+$/.test(githubUsername)
  || typeof workshopId !== 'string' || !/^\d+$/.test(workshopId)
  || typeof repository !== 'string' || !/^[\w.-]+\/[\w.-]+$/.test(repository)) {
  throw new Error('Set a valid GitHub username, repository, and Steam Workshop ID in data/source.json.');
}

const headers = {
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2026-03-10',
  ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
};

async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { 'User-Agent': 'DeisDevSite (https://github.com/DeisDev)', ...options.headers },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new Error(`${new URL(url).hostname} returned HTTP ${response.status}; the saved snapshot was not replaced.`);
  }
  return response.json();
}

async function pages(path, limit = Infinity) {
  const result = [];
  for (let page = 1; page <= limit; page++) {
    const batch = await request(`https://api.github.com${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${page}`, { headers });
    if (!Array.isArray(batch)) throw new Error(`Expected a list from GitHub ${path}.`);
    result.push(...batch);
    if (batch.length < 100) break;
  }
  return result;
}

function count(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`Invalid ${label} from the public API.`);
  return value;
}

const [profile, repos, events, steam, release] = await Promise.all([
  request(`https://api.github.com/users/${githubUsername}`, { headers }),
  pages(`/users/${githubUsername}/repos?type=owner&sort=updated`),
  pages(`/users/${githubUsername}/events/public`, 3),
  request('https://api.steampowered.com/ISteamRemoteStorage/GetPublishedFileDetails/v1/', {
    method: 'POST',
    body: new URLSearchParams({ itemcount: '1', 'publishedfileids[0]': workshopId }),
  }),
  request(`https://api.github.com/repos/${repository}/releases/latest`, { headers }),
]);

if (profile.login?.toLowerCase() !== githubUsername.toLowerCase()) throw new Error('Unexpected GitHub profile.');
const addon = steam.response?.publishedfiledetails?.find((item) => item.publishedfileid === workshopId);
if (!addon || addon.result !== 1 || addon.consumer_app_id !== 4000) throw new Error('Better Lights Workshop statistics are unavailable.');
if (release.draft !== false || release.prerelease !== false || typeof release.tag_name !== 'string') {
  throw new Error('Expected a published stable nwmpublisher release.');
}

const updatedAt = new Date().toISOString();
const today = new Date(updatedAt.slice(0, 10) + 'T00:00:00Z');
const activity = Array.from({ length: 30 }, (_, index) => ({
  date: new Date(today.getTime() - (29 - index) * 86_400_000).toISOString().slice(0, 10),
  count: 0,
}));
const counts = new Map(activity.map((day) => [day.date, day]));
const eventIds = new Set();
for (const event of events) {
  if (typeof event.id !== 'string' || typeof event.created_at !== 'string'
    || !Number.isFinite(Date.parse(event.created_at)) || typeof event.repo?.name !== 'string') {
    throw new Error('Invalid GitHub public event.');
  }
  if (eventIds.has(event.id)) continue;
  eventIds.add(event.id);
  const day = counts.get(event.created_at.slice(0, 10));
  if (day) day.count++;
}

const snapshot = {
  updatedAt,
  github: {
    username: profile.login,
    repositories: count(profile.public_repos, 'repository count'),
    followers: count(profile.followers, 'followers'),
    stars: repos.reduce((sum, repo) => sum + count(repo.stargazers_count, 'repository stars'), 0),
    forks: repos.reduce((sum, repo) => sum + count(repo.forks_count, 'repository forks'), 0),
    activity,
    // The Events API exposes at most 300 events in the last 30 days, not the contributions calendar.
    activityLimited: events.length === 300,
  },
  steam: {
    workshopId,
    subscribers: count(addon.subscriptions, 'Workshop subscribers'),
    favorites: count(addon.favorited, 'Workshop favorites'),
    views: count(addon.views, 'Workshop views'),
  },
  release: {
    version: release.tag_name,
    url: `https://github.com/${repository}/releases/tag/${encodeURIComponent(release.tag_name)}`,
  },
};

// Keep the last valid snapshot intact if any source or validation fails.
const path = new URL('../data/stats.json', import.meta.url);
const temporary = new URL('../data/stats.json.tmp', import.meta.url);
await writeFile(temporary, JSON.stringify(snapshot, null, 2) + '\n');
await rename(temporary, path);
console.log(`Updated public GitHub activity, Better Lights Workshop statistics, and release ${release.tag_name}.`);
