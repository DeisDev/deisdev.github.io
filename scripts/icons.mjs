import { siGithub, siModrinth, siNexusmods, siSteam } from 'simple-icons';

const icons = { github: siGithub, modrinth: siModrinth, nexusmods: siNexusmods, steam: siSteam };

export function renderSimpleIcons(html) {
  return html.replace(/<!-- SIMPLE_ICON:([a-z]+) -->/g, (_, slug) => {
    const icon = icons[slug];
    if (!icon) throw new Error('Unknown Simple Icon: ' + slug);
    return '<svg class="link-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="' + icon.path + '"></path></svg>';
  });
}
