import { defineConfig } from 'vitepress';
import { generateSidebar } from 'vitepress-sidebar';

const base = process.env.VITEPRESS_BASE || '/';

// 一级目录排序优先级（内部依然由 vitepress-sidebar 按文件名自动扫描生成，零手动配置）
const folderPriority = [
  'LLM',
  'Cloud',
  'Network',
  'Web',
  'Linux',
  'C&C++',
  'Rust',
  'Python',
  'Software-Engineering',
  'Tools',
  'OpenGL',
  'OCC',
  'hardware',
  'macOS',
  'Windows',
  'Web3',
  'life'
];

const rawSidebar = generateSidebar({
  documentRootPath: 'docs',
  collapsed: true,
  capitalizeFirst: false,
  useTitleFromFileHeading: false,
  sortMenusByName: true,
});

const sortedSidebar = Array.isArray(rawSidebar)
  ? [...rawSidebar].sort((a, b) => {
      const idxA = folderPriority.findIndex(
        (p) => p.toLowerCase() === (a.text || '').toLowerCase()
      );
      const idxB = folderPriority.findIndex(
        (p) => p.toLowerCase() === (b.text || '').toLowerCase()
      );
      const rankA = idxA === -1 ? 999 : idxA;
      const rankB = idxB === -1 ? 999 : idxB;
      return rankA - rankB;
    })
  : rawSidebar;

export default defineConfig({
  srcDir: 'docs',
  base,
  title: 'Notes',
  description: '工程参考与技术笔记',
  lastUpdated: true,
  head: [
    ['link', { rel: 'preconnect', href: 'https://fonts.googleapis.com' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' }],
    [
      'link',
      {
        href: 'https://fonts.googleapis.com/css2?family=Geist:wght@400;500;700&family=Geist+Mono:wght@400;500&display=swap',
        rel: 'stylesheet'
      }
    ]
  ],
  markdown: {
    math: true,
    lineNumbers: false
  },
  themeConfig: {
    nav: [
      { text: '索引', link: '/' },
      { text: 'LLM', link: '/LLM/1-Transformer与基础概念' },
      { text: 'Cloud', link: '/Cloud/1-虚拟化、转译与算力底座' },
      { text: 'Network', link: '/Network/1-分层模型、网卡与路由基础' },
      { text: 'Web', link: '/Web/1-HTTP协议与Web通信基础' },
      { text: 'C & C++', link: '/C&C++/C&C++工程' },
      { text: 'Rust', link: '/Rust/Rust基本' },
      { text: 'Linux', link: '/Linux/概念' }
    ],
    search: {
      provider: 'local',
      options: {
        translations: {
          button: {
            buttonText: '检索',
            buttonAriaLabel: '检索笔记'
          },
          modal: {
            noResultsText: '未找到匹配条目',
            resetButtonTitle: '清空',
            footer: {
              selectText: '打开',
              navigateText: '上下移动',
              closeText: '退出'
            }
          }
        }
      }
    },
    outline: {
      level: [2, 3],
      label: '本页章节'
    },
    docFooter: {
      prev: '上一篇',
      next: '下一篇'
    },
    lastUpdated: {
      text: '更新于'
    },
    sidebar: sortedSidebar,
    socialLinks: [
      { icon: 'github', link: 'https://github.com/wosnxuw' }
    ]
  }
});
