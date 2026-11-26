import DefaultTheme from 'vitepress/theme'
import Layout from './Layout.vue'
import HomeIndex from './HomeIndex.vue'
import './custom.css'

export default {
  extends: DefaultTheme,
  Layout,
  enhanceApp({ app }) {
    app.component('HomeIndex', HomeIndex)
  }
}
