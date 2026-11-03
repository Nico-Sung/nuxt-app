<script setup lang="ts">
import type { PokemonDetails } from '#shared/types/pokemon'
import type { WishlistItem } from '#shared/types/wishlist'
import { formatNumber } from '#shared/utils/format'
import { pokemonSlug, smallSpriteUrl } from '#shared/utils/pokeapi'
import { typeInfo } from '#shared/utils/types'

const props = defineProps<{
  item: WishlistItem
}>()

defineEmits<{
  remove: [pokemonId: number]
}>()

const pokemon = computed(() => props.item.pokemon)

const {
  data: details,
  status,
  refresh,
} = useLazyFetch<PokemonDetails>(() => `/api/pokemon/${pokemon.value.id}`, {
  key: `pokemon-details-${pokemon.value.id}`,
})

const mainColor = computed(() => {
  const main = details.value?.types[0]
  return main ? typeInfo(main).color : '#9099a1'
})
const profileUrl = computed(() => `/pokemon/${pokemonSlug(pokemon.value.name)}`)

const imageState = ref<'artwork' | 'small' | 'missing'>('artwork')

const imageSrc = computed(() =>
  imageState.value === 'artwork'
    ? pokemon.value.sprite
    : smallSpriteUrl(pokemon.value.id),
)

function onImageError() {
  imageState.value = imageState.value === 'artwork' ? 'small' : 'missing'
}
</script>

<template>
  <article class="card" :style="{ '--type-color': mainColor }">
    <div class="art">
      <img
        v-if="imageState !== 'missing'"
        :src="imageSrc"
        :alt="pokemon.name"
        width="160"
        height="160"
        loading="lazy"
        @error="onImageError"
      />
    </div>

    <div class="body">
      <span class="num">{{ formatNumber(pokemon.id) }}</span>
      <h3 class="name">
        <NuxtLink :to="profileUrl">{{ pokemon.name }}</NuxtLink>
      </h3>

      <TypeBadges v-if="details" class="card-types" :types="details.types" />

      <StatBars v-if="details" class="card-stats" :stats="details.stats" />

      <p v-else-if="status === 'error'" class="stats-error">
        Stats indisponibles.
        <button type="button" class="link" @click="refresh()">Réessayer</button>
      </p>

      <div v-else class="stats skeleton" aria-label="Chargement des stats">
        <span v-for="n in 6" :key="n" class="skeleton-row" />
      </div>

      <button
        type="button"
        class="remove"
        :aria-label="`Retirer ${pokemon.name}`"
        @click="$emit('remove', pokemon.id)"
      >
        Retirer
      </button>
    </div>
  </article>
</template>

<style scoped>
.card {
  display: flex;
  flex-direction: column;
  background: #fff;
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow: hidden;
  transition: border-color 0.15s ease;
}

.card:hover {
  border-color: #c4c4c4;
}

.art {
  aspect-ratio: 4 / 3;
  padding: 12px;
  background: color-mix(in srgb, var(--type-color) 14%, #fff);
  border-bottom: 1px solid color-mix(in srgb, var(--type-color) 25%, #fff);
}

.art img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.body {
  display: flex;
  flex: 1;
  flex-direction: column;
  padding: 12px 14px 10px;
}

.num {
  font-size: 0.8rem;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}

.name {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.name a {
  color: inherit;
  text-decoration: none;
}

.name a:hover {
  text-decoration: underline;
}

.card-types {
  margin-top: 8px;
}

.card-stats,
.stats.skeleton {
  margin: 12px 0 10px;
}

.stats.skeleton {
  display: grid;
  gap: 4px;
}

.skeleton-row {
  display: block;
  height: 14px;
  border-radius: 4px;
  background: #f0f0f0;
}

.stats-error {
  margin: 12px 0 10px;
  font-size: 0.85rem;
  color: var(--muted);
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

.remove {
  margin-top: auto;
  align-self: flex-start;
  padding: 4px 0;
  border: 0;
  background: none;
  color: var(--muted);
  font-size: 0.875rem;
  cursor: pointer;
}

.remove:hover {
  color: var(--red);
  text-decoration: underline;
}
</style>
