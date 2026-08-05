import sanitizeHtml from 'sanitize-html';

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function text(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new Error('Missing ' + label + '.');
}

function officialUrl(value, host, prefix) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.hostname !== host || url.username || url.password || !url.pathname.startsWith(prefix)) {
    throw new Error('Unexpected repository URL.');
  }
}

export function validateFeatured(data) {
  if (!Number.isSafeInteger(data.subscribers) || data.subscribers < 0) throw new Error('Invalid Better Lights subscriber count.');
  text(data.name, 'repository name');
  if (typeof data.description !== 'string') throw new Error('Invalid repository description.');
  if (!/^[\w.-]+\/[\w.-]+$/.test(data.repository)) throw new Error('Invalid repository identifier.');
  officialUrl(data.repoUrl, 'github.com', '/' + data.repository);
  if (new URL(data.repoUrl).pathname !== '/' + data.repository) throw new Error('Unexpected repository URL.');
  text(data.version, 'release version');
  officialUrl(data.releaseUrl, 'github.com', '/' + data.repository + '/releases/tag/');
  officialUrl(data.readmeUrl, 'github.com', '/' + data.repository + '/blob/');
  officialUrl(data.readmeRawUrl, 'raw.githubusercontent.com', '/' + data.repository + '/');
  text(data.readmeHtml, 'README HTML');
  if (typeof data.hasIssues !== 'boolean') throw new Error('Invalid issue tracker setting.');
  if (!Array.isArray(data.downloads) || !data.downloads.length) throw new Error('No release downloads available.');
  const urls = new Set();
  for (const asset of data.downloads) {
    text(asset.name, 'download name');
    officialUrl(asset.url, 'github.com', '/' + data.repository + '/releases/download/');
    if (urls.has(asset.url)) throw new Error('Duplicate download.');
    urls.add(asset.url);
  }
}

export function renderReadme(data) {
  const prefix = 'project-readme-';
  return sanitizeHtml(data.readmeHtml, {
    allowedTags: ['article', 'div', 'span', 'p', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'a', 'img', 'strong', 'b', 'em', 'i', 'del', 's', 'code', 'pre', 'blockquote', 'hr', 'br', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'details', 'summary', 'kbd', 'sup', 'sub'],
    allowedAttributes: { '*': ['id'], a: ['href', 'title'], img: ['src', 'alt', 'width', 'height', 'loading'], th: ['colspan', 'rowspan'], td: ['colspan', 'rowspan'] },
    allowedSchemes: ['https', 'http', 'mailto'],
    allowedSchemesByTag: { img: ['https'] },
    allowProtocolRelative: false,
    transformTags: {
      '*': (tagName, attribs) => {
        const attrs = { ...attribs };
        if (attrs.id) attrs.id = prefix + attrs.id;
        if (/^h[1-6]$/.test(tagName)) tagName = 'h' + Math.min(6, Number(tagName[1]) + 2);
        if (tagName === 'a' && attribs.class?.split(' ').includes('anchor')) {
          return { tagName: 'span', attribs: attrs.id ? { id: attrs.id } : {} };
        }
        if (tagName === 'a' && attrs.href) {
          if (attrs.href.startsWith('#')) {
            const id = attrs.href.slice(1);
            const actual = data.readmeHtml.includes('id="' + id + '"') ? id : 'user-content-' + id;
            attrs.href = '#' + prefix + actual;
          } else {
            attrs.href = new URL(attrs.href, data.readmeUrl).href;
          }
        }
        if (tagName === 'img') {
          if (attrs.src) attrs.src = new URL(attrs.src, data.readmeRawUrl).href;
          attrs.loading = 'lazy';
          attrs.alt ??= '';
        }
        return { tagName, attribs: attrs };
      }
    }
  });
}

function downloadLabel(asset) {
  const filename = decodeURIComponent(new URL(asset.url).pathname.split('/').pop());
  if (/\.(msi|exe)$/i.test(filename) || /(?:^|[_.-])windows(?:[_.-]|$)/i.test(filename)) return 'Windows';
  if (/\.(dmg|pkg)$/i.test(filename) || /(?:^|[_.-])(?:macos|darwin)(?:[_.-]|$)/i.test(filename)) return 'macOS';
  if (/\.(deb|rpm|AppImage)$/i.test(filename) || /(?:^|[_.-])linux(?:64|32)?(?:[_.-]|$)/i.test(filename)) return 'Linux';
  return asset.name;
}

export function renderFeatured(template, data) {
  validateFeatured(data);
  const e = escapeHtml;
  const downloads = '<ul class="downloads">' + data.downloads.map((asset) =>
    '<li><a href="' + e(asset.url) + '" title="' + e(asset.name) + '"><svg class="link-icon" width="16" height="16" aria-hidden="true" focusable="false"><use href="#icon-download"></use></svg>' + e(downloadLabel(asset)) + '</a></li>'
  ).join('') + '</ul>';
  const section = '<section aria-labelledby="featured-project">' +
    '<h2 id="featured-project">' + e(data.name) + '</h2>' +
    '<p>' + e(data.description) + '</p>' +
    '<div class="download-panel"><h3>Downloads</h3>' +
    '<p class="release">Version ' + e(data.version) + ' · <a href="' + e(data.releaseUrl) + '"><svg class="link-icon" width="16" height="16" aria-hidden="true" focusable="false"><use href="#icon-release"></use></svg>Release notes</a></p>' +
    downloads + '</div>' +
    '<details class="readme"><summary>README</summary><div class="readme-content">' + renderReadme(data) + '</div></details>' +
    '<div class="links"><a href="' + e(data.repoUrl) + '"><svg class="link-icon" width="16" height="16" aria-hidden="true" focusable="false"><use href="#icon-code"></use></svg>Source</a>' +
    (data.hasIssues ? '<a href="' + e(data.repoUrl + '/issues') + '"><svg class="link-icon" width="16" height="16" aria-hidden="true" focusable="false"><use href="#icon-issue"></use></svg>Issues</a>' : '') +
    '<a href="' + e(data.repoUrl + '/releases') + '"><svg class="link-icon" width="16" height="16" aria-hidden="true" focusable="false"><use href="#icon-release"></use></svg>All releases</a></div></section>';
  for (const [key, value] of Object.entries({ SUBSCRIBERS: new Intl.NumberFormat('en').format(data.subscribers), FEATURED_PROJECT: section })) {
    const token = '<!-- ' + key + ' -->';
    if (!template.includes(token)) throw new Error('Missing template token: ' + key);
    template = template.replace(token, () => value);
  }
  return template;
}
