<script setup lang="ts">
import type { Pokemon } from '#shared/types/pokemon'
import { smallSpriteUrl } from '#shared/utils/pokeapi'
import { MIN_QUERY_LENGTH } from '#shared/utils/search'

const props = defineProps<{
  isInList: (id: number) => boolean
  /** Liste pleine : plus aucun ajout possible. */
  isFull: boolean
}>()

function canAdd(id: number): boolean {
  return !props.isInList(id) && !props.isFull
}

function actionLabel(id: number): string {
  if (props.isInList(id)) return 'Dans la liste'
  if (props.isFull) return 'Liste pleine'
  return 'Ajouter'
}

const emit = defineEmits<{
  add: [pokemon: Pokemon]
}>()

type Status = 'idle' | 'short' | 'loading' | 'done' | 'error'

const DEBOUNCE_MS = 300

const query = ref('')
const results = ref<Pokemon[]>([])
const status = ref<Status>('idle')
const activeIndex = ref(-1)

let timer: ReturnType<typeof setTimeout> | undefined
let lastRequest = 0

const activeId = computed(() =>
  activeIndex.value >= 0
    ? `result-${results.value[activeIndex.value]?.id}`
    : undefined,
)

async function runSearch(q: string) {
  const requestId = ++lastRequest
  status.value = 'loading'
  try {
    const data = await $fetch<Pokemon[]>('/api/pokemon/search', {
      query: { q },
    })
    if (requestId !== lastRequest) return // une recherche plus récente a été lancée
    results.value = data
    activeIndex.value = data.length ? 0 : -1
    status.value = 'done'
  } catch {
    if (requestId !== lastRequest) return
    results.value = []
    status.value = 'error'
  }
}

watch(query, (value) => {
  clearTimeout(timer)
  const q = value.trim()

  if (!q) {
    lastRequest++
    results.value = []
    status.value = 'idle'
    return
  }
  if (!/^\d+$/.test(q) && q.length < MIN_QUERY_LENGTH) {
    lastRequest++
    results.value = []
    status.value = 'short'
    return
  }
  timer = setTimeout(() => runSearch(q), DEBOUNCE_MS)
})

onBeforeUnmount(() => clearTimeout(timer))

function retry() {
  const q = query.value.trim()
  if (q) runSearch(q)
}

function choose(pokemon: Pokemon) {
  if (!canAdd(pokemon.id)) return
  emit('add', pokemon)
}

function onKeydown(event: KeyboardEvent) {
  const count = results.value.length
  switch (event.key) {
    case 'ArrowDown':
      if (!count) return
      event.preventDefault()
      activeIndex.value = (activeIndex.value + 1) % count
      break
    case 'ArrowUp':
      if (!count) return
      event.preventDefault()
      activeIndex.value = (activeIndex.value - 1 + count) % count
      break
    case 'Enter': {
      const current = results.value[activeIndex.value]
      if (current) {
        event.preventDefault()
        choose(current)
      }
      break
    }
    case 'Escape':
      query.value = ''
      break
  }
}
</script>

<template>
  <div class="search">
    <label for="pokemon-search" class="sr-only">Rechercher un Pokémon</label>
    <input
      id="pokemon-search"
      v-model="query"
      type="search"
      role="combobox"
      autocomplete="off"
      spellcheck="false"
      placeholder="Rechercher un Pokémon (nom, n° ou #025)"
      aria-autocomplete="list"
      aria-controls="search-results"
      :aria-expanded="results.length > 0"
      :aria-activedescendant="activeId"
      @keydown="onKeydown"
    />

    <p v-if="status === 'short'" class="hint">
      Tape au moins {{ MIN_QUERY_LENGTH }} caractères.
    </p>
    <p v-else-if="status === 'loading'" class="hint" aria-live="polite">
      Recherche…
    </p>
    <p v-else-if="status === 'error'" class="hint error" role="alert">
      PokéAPI ne répond pas.
      <button type="button" class="link" @click="retry">Réessayer</button>
    </p>
    <p
      v-else-if="status === 'done' && !results.length"
      class="hint"
      aria-live="polite"
    >
      Aucun résultat.
    </p>

    <ul
      v-show="status === 'done' && results.length"
      id="search-results"
      role="listbox"
      class="results"
    >
      <li
        v-for="(pokemon, i) in results"
        :id="`result-${pokemon.id}`"
        :key="pokemon.id"
        role="option"
        class="result"
        :class="{ active: i === activeIndex }"
        :aria-selected="i === activeIndex"
        :aria-disabled="!canAdd(pokemon.id)"
        @mouseenter="activeIndex = i"
        @click="choose(pokemon)"
      >
        <img
          :src="smallSpriteUrl(pokemon.id)"
          alt=""
          width="40"
          height="40"
          loading="lazy"
        />
        <span class="num">#{{ String(pokemon.id).padStart(3, '0') }}</span>
        <span class="name">{{ pokemon.name }}</span>
        <span class="action" :class="{ taken: !canAdd(pokemon.id) }">
          {{ actionLabel(pokemon.id) }}
        </span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.search {
  max-width: 720px;
  margin: 0 auto;
}

input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #cfcfcf;
  border-radius: 8px;
  background: #fff;
  font-size: 1rem;
}

input:focus {
  outline: none;
  border-color: var(--red);
  box-shadow: 0 0 0 3px rgb(211 32 47 / 0.15);
}

.hint {
  margin: 8px 2px 0;
  font-size: 0.9rem;
  color: var(--muted);
}

.error {
  color: var(--red);
}

.link {
  border: 0;
  background: none;
  padding: 0;
  margin-left: 6px;
  color: inherit;
  text-decoration: underline;
  cursor: pointer;
}

.results {
  list-style: none;
  margin: 8px 0 0;
  padding: 4px;
  background: #fff;
  border: 1px solid var(--border);
  border-radius: 8px;
  max-height: 360px;
  overflow-y: auto;
}

.result {
  display: grid;
  grid-template-columns: 40px 64px 1fr auto;
  align-items: center;
  gap: 8px;
  padding: 2px 8px;
  border-radius: 6px;
  cursor: pointer;
}

.result.active {
  background: #f2f2f2;
}

.result[aria-disabled='true'] {
  cursor: default;
}

.num {
  font-size: 0.85rem;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}

.name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.action {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--red);
}

.action.taken {
  font-weight: 400;
  color: var(--muted);
}
</style>
