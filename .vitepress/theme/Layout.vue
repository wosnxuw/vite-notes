<script setup>
import { computed } from 'vue'
import DefaultTheme from 'vitepress/theme'
import { useData } from 'vitepress'

const { Layout } = DefaultTheme
const { page } = useData()

const formattedDate = computed(() => {
  const ts = page.value.lastUpdated
  if (!ts) return ''
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
})
</script>

<template>
  <Layout>
    <template #doc-before>
      <div v-if="formattedDate" class="doc-header-date">
        更新于 {{ formattedDate }}
      </div>
    </template>
  </Layout>
</template>

<style scoped>
.doc-header-date {
  font-size: 13px;
  line-height: 1.4;
  color: var(--muted);
  margin-bottom: 10px;
  font-variant-numeric: tabular-nums;
}
</style>
