import type { Pokemon } from '#shared/types/pokemon'
import type { WishlistItem } from '#shared/types/wishlist'

const STORAGE_KEY = 'pokemon-a-capturer'

export function useWishlist() {
  const items = useState<WishlistItem[]>('wishlist', () => [])
  /** Passe à true une fois la liste relue depuis le localStorage (côté navigateur). */
  const loaded = useState('wishlist-loaded', () => false)

  if (import.meta.client) {
    onMounted(() => {
      if (loaded.value) return
      try {
        items.value = parseStoredWishlist(localStorage.getItem(STORAGE_KEY))
      } catch {
        items.value = []
      }
      loaded.value = true
      watch(
        items,
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
    items: readonly(items),
    loaded: readonly(loaded),
    has: (pokemonId: number) =>
      items.value.some((item) => item.pokemon.id === pokemonId),
    add: (pokemon: Pokemon) => {
      items.value = addToWishlist(items.value, pokemon)
    },
    remove: (pokemonId: number) => {
      items.value = removeFromWishlist(items.value, pokemonId)
    },
    clear: () => {
      items.value = []
    },
  }
}
