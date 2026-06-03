<template>
  <div class="docs-view container">
    <h1 class="page-title">Documents</h1>
    <p class="text-muted">Collaborative document management.</p>

    <div class="toolbar mt-xl">
      <input
        v-model="search"
        type="search"
        class="search-input"
        placeholder="Search documents…"
        aria-label="Search documents"
      />
      <select v-model="filterType" class="filter-select" aria-label="Filter by type">
        <option value="">All types</option>
        <option v-for="t in documentTypes" :key="t" :value="t">{{ t }}</option>
      </select>
    </div>

    <div v-if="loading" class="loading">Loading…</div>

    <div v-else-if="filteredDocs.length === 0" class="empty-state">
      <p>No documents found.</p>
    </div>

    <ul v-else class="docs-grid">
      <li v-for="doc in filteredDocs" :key="doc.id" class="doc-card card">
        <div class="card-header">
          <h3 class="doc-title">{{ doc.title || doc.name || 'Untitled' }}</h3>
          <span v-if="doc.document_type" class="badge">{{ doc.document_type }}</span>
        </div>
        <div class="card-body">
          <p v-if="doc.content" class="doc-preview">{{ truncate(doc.content, 200) }}</p>
          <div class="doc-meta">
            <span>{{ formatTime(doc.updated_at || doc.created_at) }}</span>
            <span v-if="doc.is_public" class="badge badge-success">Public</span>
          </div>
        </div>
      </li>
    </ul>

    <p v-if="error" class="error-text mt-md" role="alert">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useUIStore } from '../stores/ui'
import { supabase } from '../lib/supabase'

interface DocRow {
  id: string
  title: string | null
  name: string | null
  content: string | null
  document_type: string | null
  is_public?: boolean
  created_at: string
  updated_at?: string
}

const uiStore = useUIStore()

const search = ref('')
const filterType = ref('')
const loading = ref(false)
const error = ref('')
const docs = ref<DocRow[]>([])
const documentTypes = ref<string[]>([])

const filteredDocs = computed(() => {
  let out = docs.value
  if (filterType.value) out = out.filter((d) => d.document_type === filterType.value)
  if (search.value.trim()) {
    const q = search.value.toLowerCase()
    out = out.filter(
      (d) =>
        (d.title || '').toLowerCase().includes(q) ||
        (d.name || '').toLowerCase().includes(q) ||
        (d.content || '').toLowerCase().includes(q)
    )
  }
  return out
})

function truncate(s: string, n: number) {
  return s.length <= n ? s : `${s.slice(0, n).trim()}…`
}

function formatTime(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString()
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const { data, error: fetchError } = await supabase
      .from('documents')
      .select('id, title, name, content, document_type, is_public, created_at, updated_at')
      .order('updated_at', { ascending: false, nullsFirst: false })
      .limit(100)
    if (fetchError) throw fetchError
    docs.value = (data ?? []) as DocRow[]
    const types = new Set<string>()
    for (const d of docs.value) if (d.document_type) types.add(d.document_type)
    documentTypes.value = Array.from(types).sort()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load documents'
    docs.value = []
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.docs-view { padding: var(--spacing-xl) 0; }
.page-title { font-size: 1.5rem; font-weight: 800; margin: 0; }
.text-muted { color: var(--text-muted); }
.mt-xl { margin-top: var(--spacing-xl); }
.mt-md { margin-top: var(--spacing-md); }
.toolbar {
  display: flex;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-lg);
  flex-wrap: wrap;
}
.search-input, .filter-select {
  padding: var(--spacing-sm) var(--spacing-md);
  border: 2px solid var(--border-color);
  background: var(--bg-secondary);
  color: var(--text-color);
  font-size: var(--text-base);
  font-family: inherit;
}
.search-input { flex: 1; min-width: 200px; }
.docs-grid {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--spacing-md);
}
.doc-card { display: flex; flex-direction: column; }
.doc-title { margin: 0; font-size: 1rem; }
.doc-preview {
  color: var(--text-muted);
  font-size: var(--text-sm);
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.doc-meta {
  display: flex;
  justify-content: space-between;
  margin-top: var(--spacing-sm);
  color: var(--text-muted);
  font-size: var(--text-sm);
}
.empty-state, .loading {
  text-align: center;
  padding: var(--spacing-2xl);
  color: var(--text-muted);
}
.error-text { color: var(--error-color); font-size: var(--text-sm); }
</style>
