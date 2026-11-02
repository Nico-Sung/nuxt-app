<script setup lang="ts">
import type { PokemonDetails } from '#shared/types/pokemon'
import { STAT_NAMES } from '#shared/types/pokemon'
import type { WishlistItem } from '#shared/types/wishlist'
import { smallSpriteUrl } from '#shared/utils/pokeapi'
import {
  STAT_LABELS,
  statLevel,
  statPercent,
  totalStats,
} from '#shared/utils/stats'
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

const types = computed(() =>
  (details.value?.types ?? []).map((name) => ({ name, ...typeInfo(name) })),
)
const mainColor = computed(() => types.value[0]?.color ?? '#9099a1')
const total = computed(() =>
  details.value ? totalStats(details.value.stats) : 0,
)

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
      <span class="num">#{{ String(pokemon.id).padStart(3, '0') }}</span>
      <h3 class="name">
        {{ pokemon.name }}
      </h3>

      <ul v-if="types.length" class="types" aria-label="Types">
        <li
          v-for="type in types"
          :key="type.name"
          class="type"
          :style="{ background: type.color }"
        >
          {{ type.label }}
        </li>
      </ul>

      <dl v-if="details" class="stats">
        <div v-for="name in STAT_NAMES" :key="name" class="stat">
          <dt>{{ STAT_LABELS[name] }}</dt>
          <dd>
            <span class="value">{{ details.stats[name] }}</span>
            <span class="bar" aria-hidden="true">
              <span
                class="fill"
                :class="statLevel(details.stats[name])"
                :style="{ width: `${statPercent(details.stats[name])}%` }"
              />
            </span>
          </dd>
        </div>
        <div class="stat total">
          <dt>Total</dt>
          <dd>
            <span class="value">{{ total }}</span>
          </dd>
        </div>
      </dl>

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

.types {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin: 8px 0 0;
  padding: 0;
  list-style: none;
}

.type {
  padding: 2px 8px;
  border-radius: 999px;
  color: #fff;
  font-size: 0.75rem;
  font-weight: 600;
}

.stats {
  margin: 12px 0 10px;
  display: grid;
  gap: 4px;
}

.stat {
  display: grid;
  grid-template-columns: 4.6em 1fr;
  align-items: center;
  gap: 8px;
  font-size: 0.8rem;
}

.stat dt {
  color: var(--muted);
}

.stat dd {
  margin: 0;
  display: grid;
  grid-template-columns: 2.2em 1fr;
  align-items: center;
  gap: 6px;
}

.value {
  text-align: right;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.bar {
  height: 6px;
  border-radius: 3px;
  background: #eee;
  overflow: hidden;
}

.fill {
  display: block;
  height: 100%;
  border-radius: 3px;
}

.fill.low {
  background: #e0645c;
}

.fill.mid {
  background: #e3b23c;
}

.fill.high {
  background: #4caf6a;
}

.stat.total {
  margin-top: 4px;
  padding-top: 6px;
  border-top: 1px solid var(--border);
}

.stat.total dt,
.stat.total .value {
  color: var(--ink);
  font-weight: 700;
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
