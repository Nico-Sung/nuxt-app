<script setup lang="ts">
import type { WishlistItem } from '#shared/types/wishlist'
import { smallSpriteUrl } from '#shared/utils/pokeapi'

const props = defineProps<{
  item: WishlistItem
}>()

defineEmits<{
  remove: [pokemonId: number]
}>()

const pokemon = computed(() => props.item.pokemon)

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
  <article class="card">
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
    <span class="num">#{{ String(pokemon.id).padStart(3, '0') }}</span>
    <h3 class="name">
      {{ pokemon.name }}
    </h3>
    <button
      type="button"
      class="remove"
      :aria-label="`Retirer ${pokemon.name}`"
      @click="$emit('remove', pokemon.id)"
    >
      Retirer
    </button>
  </article>
</template>

<style scoped>
.card {
  display: flex;
  flex-direction: column;
  background: #fff;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px;
}

.art {
  aspect-ratio: 1;
  background: var(--bg);
  border-radius: 6px;
}

.art img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.num {
  margin-top: 10px;
  font-size: 0.8rem;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}

.name {
  margin: 0 0 10px;
  font-size: 1rem;
  font-weight: 600;
  overflow-wrap: anywhere;
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
