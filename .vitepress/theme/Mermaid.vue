<script setup>
import { ref, onMounted, watch } from 'vue'
import { useData } from 'vitepress'

const props = defineProps({
  code: {
    type: String,
    required: true
  }
})

const { isDark } = useData()
const svg = ref('')
const error = ref('')

async function renderDiagram() {
  if (typeof window === 'undefined') return
  try {
    const { default: mermaid } = await import('mermaid')
    mermaid.initialize({
      startOnLoad: false,
      theme: isDark.value ? 'dark' : 'default',
      securityLevel: 'loose'
    })
    const id = `mermaid-${Math.random().toString(36).slice(2, 11)}`
    const decoded = decodeURIComponent(props.code)
    const result = await mermaid.render(id, decoded)
    svg.value = result.svg
    error.value = ''
  } catch (err) {
    error.value = err?.message || String(err)
  }
}

onMounted(renderDiagram)
watch(isDark, renderDiagram)
</script>

<template>
  <div class="mermaid-wrapper">
    <div v-if="svg" class="mermaid-svg" v-html="svg" />
    <pre v-else-if="error" class="mermaid-error">{{ error }}</pre>
  </div>
</template>

<style scoped>
.mermaid-wrapper {
  display: flex;
  justify-content: center;
  margin: 1.25rem 0;
  overflow-x: auto;
}

.mermaid-svg :deep(svg) {
  max-width: 100%;
  height: auto;
}

.mermaid-error {
  color: var(--vp-c-danger-1);
  font-size: 0.85rem;
  white-space: pre-wrap;
}
</style>
