import { defineConfig } from 'vitepress';
import { generateSidebar } from 'vitepress-sidebar';

const base = process.env.VITEPRESS_BASE || '/';

// https://vitepress.dev/reference/site-config
export default defineConfig({
  srcDir: "docs",
  base,
  title: "Notes",
  description: "笔记",
  markdown: {
    math: true,
    config: (md) => {
      const defaultFence = md.renderer.rules.fence
      md.renderer.rules.fence = (tokens, idx, options, env, self) => {
        const token = tokens[idx]
        if (token.info.trim() === 'mermaid') {
          return `<Mermaid code="${encodeURIComponent(token.content)}" />`
        }
        return defaultFence
          ? defaultFence(tokens, idx, options, env, self)
          : self.renderToken(tokens, idx, options)
      }
    }
  },
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    //nav: [
    //  { text: 'Home', link: '/' },
    //  { text: 'Examples', link: '/markdown-examples' }
    //],
    search: {
      provider: 'local'
    },
    sidebar: generateSidebar({
      /* 这里的选项可以自定义你的需求 */
      documentRootPath: 'docs', // 文档根目录
      collapsed: true,          // 是否默认折叠
      capitalizeFirst: true,     // 首字母大写
      useTitleFromFileHeading: false, // 是否使用文章内的第一个 H1 作为标题
    }),

    socialLinks: [
      { icon: 'github', link: 'https://github.com/wosnxuw' }
    ]
  }
})
