/** Pokémon aimés depuis ce navigateur (pas de comptes : on retient localement). */
const LIKED_KEY = 'pokemon-liked'

function readLiked(): number[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(LIKED_KEY) ?? '[]')
    return Array.isArray(value)
      ? value.filter((id): id is number => Number.isInteger(id) && id > 0)
      : []
  } catch {
    return []
  }
}

function writeLiked(ids: number[]) {
  try {
    localStorage.setItem(LIKED_KEY, JSON.stringify(ids))
  } catch {
    // stockage indisponible (navigation privée…) : le like reste compté par l'API
  }
}

/**
 * Likes des Pokémon : le total vient de l'API Hono (partagé entre visiteurs),
 * « déjà aimé » est retenu dans ce navigateur. Chargé une fois, côté client.
 */
export function useLikes() {
  const apiBase = useRuntimeConfig().public.apiBase
  const counts = useState<Record<number, number>>('likes-counts', () => ({}))
  const liked = useState<number[]>('likes-mine', () => [])
  const status = useState<'idle' | 'loading' | 'ready' | 'error'>(
    'likes-status',
    () => 'idle',
  )

  async function load() {
    if (status.value === 'loading' || status.value === 'ready') return
    status.value = 'loading'
    try {
      const list = await fetchLikes(apiBase)
      counts.value = Object.fromEntries(
        list.map((item) => [item.pokemonId, item.likes]),
      )
      liked.value = readLiked()
      status.value = 'ready'
    } catch {
      status.value = 'error'
    }
  }

  if (import.meta.client) onMounted(load)

  const isLiked = (pokemonId: number) => liked.value.includes(pokemonId)

  /** Aimer / ne plus aimer ; l'état local ne change qu'après la réponse de l'API. */
  async function toggle(pokemonId: number) {
    const wasLiked = isLiked(pokemonId)
    const result = wasLiked
      ? await unlikePokemon(apiBase, pokemonId)
      : await likePokemon(apiBase, pokemonId)
    counts.value = { ...counts.value, [pokemonId]: result.likes }
    liked.value = wasLiked
      ? liked.value.filter((id) => id !== pokemonId)
      : [...liked.value, pokemonId]
    writeLiked(liked.value)
  }

  return {
    ready: computed(() => status.value === 'ready'),
    count: (pokemonId: number) => counts.value[pokemonId] ?? 0,
    isLiked,
    toggle,
  }
}
