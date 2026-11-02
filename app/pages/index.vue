<script setup lang="ts">
import type { Pokemon } from '#shared/types/pokemon'

const { items, loaded, isFull, has, add, remove, clear } = useWishlist()

/** Les derniers ajoutés en premier. */
const cards = computed(() => sortByMostRecent(items.value))

const announcement = ref('')

const FULL_MESSAGE = `Liste pleine (${MAX_WISHLIST_SIZE} Pokémon max) : retire un Pokémon pour en ajouter un autre.`

function onAdd(pokemon: Pokemon) {
  const status = add(pokemon)
  if (status === 'added') {
    announcement.value = isFull.value
      ? `${pokemon.name} ajouté. ${FULL_MESSAGE}`
      : `${pokemon.name} ajouté à la liste`
  } else if (status === 'full') {
    announcement.value = FULL_MESSAGE
  }
}

function onRemove(pokemonId: number) {
  const item = items.value.find((i) => i.pokemon.id === pokemonId)
  remove(pokemonId)
  if (item) announcement.value = `${item.pokemon.name} retiré de la liste`
}

function onClear() {
  if (window.confirm('Vider toute la liste ?')) {
    clear()
    announcement.value = 'Liste vidée'
  }
}
</script>

<template>
  <div>
    <header class="header">
      <h1>Pokémon à capturer</h1>
      <span
        v-if="loaded"
        class="total"
        :aria-label="`${items.length} sur ${MAX_WISHLIST_SIZE} dans la liste`"
        >{{ items.length }} / {{ MAX_WISHLIST_SIZE }}</span
      >
    </header>

    <main class="main">
      <p class="sr-only" aria-live="polite">
        {{ announcement }}
      </p>

      <PokemonSearch :is-in-list="has" :is-full="isFull" @add="onAdd" />
      <p v-if="loaded && isFull" class="full-notice">{{ FULL_MESSAGE }}</p>

      <section class="list" aria-labelledby="list-title">
        <h2 id="list-title">
          Ma liste<span v-if="loaded">
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
            Ta liste est vide. Recherche un Pokémon pour l'ajouter.
          </p>

          <button
            v-if="cards.length"
            type="button"
            class="clear"
            @click="onClear"
          >
            Tout vider
          </button>
        </template>
      </section>
    </main>
  </div>
</template>

<style scoped>
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px clamp(16px, 4vw, 32px);
  background: var(--red);
  border-bottom: 4px solid var(--ink);
  color: #fff;
}

h1 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
}

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

.full-notice {
  max-width: 720px;
  margin: 8px auto 0;
  font-size: 0.9rem;
  color: var(--red);
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
