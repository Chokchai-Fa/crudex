// @ts-check
/** @type {import('@docusaurus/types').Config} */
module.exports = {
  title: 'Crudex documentation',
  url: 'https://chokchai-fa.github.io',
  baseUrl: '/crudex/',
  onBrokenLinks: 'throw',
  markdown: {
    format: 'detect',
    mermaid: true,
    hooks: { onBrokenMarkdownLinks: 'throw', onBrokenMarkdownImages: 'throw' },
  },
  themes: ['@docusaurus/theme-mermaid'],
  presets: [
    [
      'classic',
      {
        docs: { routeBasePath: '/', sidebarPath: require.resolve('./sidebars.js') },
        blog: false,
        pages: false,
      },
    ],
  ],
  themeConfig: {
    navbar: {
      title: 'Crudex docs',
      items: [
        { href: 'https://github.com/Chokchai-Fa/crudex', label: 'GitHub', position: 'right' },
      ],
    },
  },
};
