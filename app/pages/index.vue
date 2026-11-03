<script setup lang="ts">
import type { Pokemon } from '#shared/types/pokemon'

const { t } = useI18n()
const { items, status, loaded, isFull, has, reload, add, remove, clear } =
  useWishlist()

/** Les derniers ajoutés en premier. */
const cards = computed(() => sortByMostRecent(items.value))

const announcement = ref('')
const errorMessage = ref('')
/** Pokémon en cours d'ajout (évite les doubles clics). */
const pendingId = ref<number | null>(null)

const fullMessage = computed(() => t('home.full', { max: MAX_WISHLIST_SIZE }))
const apiDown = () => t('home.apiNotResponding')

async function onAdd(pokemon: Pokemon) {
  if (pendingId.value !== null) return
  pendingId.value = pokemon.id
  errorMessage.value = ''
  try {
    const result = await add(pokemon)
    if (result === 'added') {
      announcement.value = isFull.value
        ? t('home.addedFull', { name: pokemon.name, full: fullMessage.value })
        : t('home.added', { name: pokemon.name })
    } else {
      // La liste a changé côté API (autre onglet, curl…) : on resynchronise.
      await reload()
      if (result === 'full') {
        // le message « Liste pleine » permanent s'affiche déjà (isFull)
        announcement.value = fullMessage.value
      } else {
        errorMessage.value = t('home.duplicate', { name: pokemon.name })
      }
    }
  } catch {
    errorMessage.value = t('home.addFailed', {
      name: pokemon.name,
      reason: apiDown(),
    })
  } finally {
    pendingId.value = null
  }
}

async function onRemove(pokemonId: number) {
  const item = items.value.find((i) => i.pokemon.id === pokemonId)
  errorMessage.value = ''
  try {
    await remove(pokemonId)
    if (item) {
      announcement.value = t('home.removed', { name: item.pokemon.name })
    }
  } catch {
    errorMessage.value = t('home.removeFailed', {
      name: item?.pokemon.name ?? t('home.thisPokemon'),
      reason: apiDown(),
    })
  }
}

async function onClear() {
  if (!window.confirm(t('home.clearConfirm'))) return
  errorMessage.value = ''
  try {
    await clear()
    announcement.value = t('home.cleared')
  } catch {
    errorMessage.value = t('home.clearFailed', { reason: apiDown() })
  }
}
</script>

<template>
  <div>
    <AppHeader home>
      <span
        v-if="loaded"
        class="total"
        :aria-label="
          t('home.counterLabel', {
            count: items.length,
            max: MAX_WISHLIST_SIZE,
          })
        "
        >{{ items.length }} / {{ MAX_WISHLIST_SIZE }}</span
      >
    </AppHeader>

    <main class="main">
      <p class="sr-only" aria-live="polite">
        {{ announcement }}
      </p>

      <PokemonSearch
        :is-in-list="has"
        :is-full="isFull"
        :pending-id="pendingId"
        @add="onAdd"
      />
      <p v-if="errorMessage" class="notice" role="alert">{{ errorMessage }}</p>
      <p v-if="loaded && isFull" class="notice">{{ fullMessage }}</p>

      <section class="list" aria-labelledby="list-title">
        <h2 id="list-title">
          {{ t('home.listTitle')
          }}<span v-if="loaded">
            ({{ items.length }}/{{ MAX_WISHLIST_SIZE }})</span
          >
        </h2>

        <template v-if="loaded">
          <div v-if="cards.length" class="grid">
            <WishlistCard
              v-for="item in cards"
              :key="item.pokemon.id"
              :item="item"
              @remove="onRemove"
            />
          </div>
          <p v-else class="empty">
            {{ t('home.empty') }}
          </p>

          <button
            v-if="cards.length"
            type="button"
            class="clear"
            @click="onClear"
          >
            {{ t('home.clear') }}
          </button>
        </template>

        <p v-else-if="status === 'error'" class="api-error" role="alert">
          {{ t('home.apiDown') }}
          <button type="button" class="link" @click="reload()">
            {{ t('home.retry') }}
          </button>
        </p>

        <p v-else class="loading">{{ t('home.loading') }}</p>
      </section>
    </main>
  </div>
</template>

<style scoped>
.total {
  min-width: 2em;
  padding: 2px 10px;
  border-radius: 999px;
  background: rgb(255 255 255 / 0.2);
  text-align: center;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.main {
  max-width: 1100px;
  margin: 0 auto;
  padding: 24px clamp(16px, 4vw, 32px) 48px;
}

.list {
  margin-top: 32px;
}

h2 {
  margin: 0 0 16px;
  font-size: 1.15rem;
  font-weight: 600;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
}

@media (max-width: 520px) {
  .grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }
}

@media (max-width: 380px) {
  .grid {
    grid-template-columns: 1fr;
  }
}

.notice {
  max-width: 720px;
  margin: 8px auto 0;
  font-size: 0.9rem;
  color: var(--red);
}

.api-error,
.loading {
  margin: 0;
  color: var(--muted);
}

.api-error {
  color: var(--red);
}

.link {
  border: 0;
  background: none;
  padding: 0;
  margin-left: 4px;
  color: inherit;
  text-decoration: underline;
  cursor: pointer;
}

.empty {
  margin: 0;
  color: var(--muted);
}

.clear {
  margin-top: 24px;
  padding: 0;
  border: 0;
  background: none;
  color: var(--muted);
  font-size: 0.875rem;
  text-decoration: underline;
  cursor: pointer;
}

.clear:hover {
  color: var(--red);
}
</style>
