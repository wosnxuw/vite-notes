import { defineConfig } from 'vitepress';
import { generateSidebar } from 'vitepress-sidebar';

// https://vitepress.dev/reference/site-config
export default defineConfig({
  srcDir: "docs",
  
  title: "Notes",
  description: "笔记",
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    //nav: [
    //  { text: 'Home', link: '/' },
    //  { text: 'Examples', link: '/markdown-examples' }
    //],

    sidebar: generateSidebar({
      /* 这里的选项可以自定义你的需求 */
      documentRootPath: 'docs', // 文档根目录
      collapsed: false,          // 是否默认折叠
      capitalizeFirst: true,     // 首字母大写
      useTitleFromFileHeading: false, // 是否使用文章内的第一个 H1 作为标题
    }),

    socialLinks: [
      { icon: 'github', link: 'https://github.com/wosnxuw' }
    ]
  }
})
