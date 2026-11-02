import type { Pokemon } from '#shared/types/pokemon'

const STORAGE_KEY = 'pokemon-a-capturer'

export function useCatchList() {
  const list = useState<Pokemon[]>('catch-list', () => [])
  /** Passe à true une fois la liste relue depuis le localStorage (côté navigateur). */
  const loaded = useState('catch-list-loaded', () => false)

  if (import.meta.client) {
    onMounted(() => {
      if (loaded.value) return
      try {
        list.value = parseStoredList(localStorage.getItem(STORAGE_KEY))
      } catch {
        list.value = []
      }
      loaded.value = true
      watch(
        list,
        (value) => {
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
          } catch {
            // stockage indisponible (navigation privée, quota) : on ignore
          }
        },
        { deep: true },
      )
    })
  }

  return {
    list: readonly(list),
    loaded: readonly(loaded),
    has: (id: number) => list.value.some((p) => p.id === id),
    add: (pokemon: Pokemon) => {
      list.value = addPokemon(list.value, pokemon)
    },
    remove: (id: number) => {
      list.value = removePokemon(list.value, id)
    },
    clear: () => {
      list.value = []
    },
  }
}
