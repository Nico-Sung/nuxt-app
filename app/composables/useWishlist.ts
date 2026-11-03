import type { Pokemon } from '#shared/types/pokemon'
import type { WishlistItem } from '#shared/types/wishlist'
import type { AddStatus } from '~/utils/wishlistApi'

export type WishlistStatus = 'loading' | 'ready' | 'error'

/**
 * Liste de Pokémon à capturer, stockée par l'API Hono (source de vérité).
 * L'état local n'est mis à jour qu'après la réponse de l'API.
 */
export function useWishlist() {
  const apiBase = useRuntimeConfig().public.apiBase
  const i18n = useNuxtApp().$i18n
  /** Langue de l'interface, envoyée à l'API (Accept-Language). */
  const lang = () => i18n.locale.value
  const items = useState<WishlistItem[]>('wishlist', () => [])
  const status = useState<WishlistStatus>('wishlist-status', () => 'loading')

  /** Recharge depuis l'API ; si la liste est déjà affichée, pas d'état « chargement » (évite le clignotement). */
  async function reload() {
    if (status.value !== 'ready') status.value = 'loading'
    try {
      items.value = await fetchWishlist(apiBase, lang())
      status.value = 'ready'
    } catch {
      status.value = 'error'
    }
  }

  if (import.meta.client) {
    onMounted(() => {
      if (status.value !== 'ready') reload()
    })
  }

  async function add(pokemon: Pokemon): Promise<AddStatus> {
    const result = await postWishlist(apiBase, pokemon, lang())
    if (result.status === 'added') {
      items.value = [...items.value, result.item]
    }
    return result.status
  }

  async function remove(pokemonId: number) {
    await deleteWishlist(apiBase, pokemonId, lang())
    items.value = removeFromWishlist(items.value, pokemonId)
  }

  /** L'API n'a pas de route « tout vider » : un DELETE par Pokémon (6 max). */
  async function clear() {
    for (const item of [...items.value]) {
      await remove(item.pokemon.id)
    }
  }

  return {
    items: readonly(items),
    status: readonly(status),
    loaded: computed(() => status.value === 'ready'),
    isFull: computed(() => isWishlistFull(items.value)),
    has: (pokemonId: number) =>
      items.value.some((item) => item.pokemon.id === pokemonId),
    reload,
    add,
    remove,
    clear,
  }
}
