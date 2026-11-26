import DefaultTheme from 'vitepress/theme'
import HomeIndex from './HomeIndex.vue'
import './custom.css'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('HomeIndex', HomeIndex)
  }
}
