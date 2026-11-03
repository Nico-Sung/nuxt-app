<script setup lang="ts">
const props = defineProps<{
  pokemonId: number
  /** Nom affiché, pour le libellé accessible. */
  name: string
}>()

const { t } = useI18n()
const likes = useLikes()
const pending = ref(false)
const failed = ref(false)

const liked = computed(() => likes.isLiked(props.pokemonId))
const count = computed(() => likes.count(props.pokemonId))

async function onClick() {
  if (pending.value) return
  pending.value = true
  failed.value = false
  try {
    await likes.toggle(props.pokemonId)
  } catch {
    failed.value = true
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <!-- Affiché seulement une fois les likes chargés depuis l'API (côté client). -->
  <button
    v-if="likes.ready.value"
    type="button"
    class="like"
    :class="{ liked }"
    :aria-pressed="liked"
    :aria-label="
      t(liked ? 'likes.unlike' : 'likes.like', { name, count: count })
    "
    :title="failed ? t('likes.error') : undefined"
    :disabled="pending"
    @click="onClick"
  >
    <span class="heart" aria-hidden="true">{{ liked ? '♥' : '♡' }}</span>
    <span class="count">{{ count }}</span>
  </button>
</template>

<style scoped>
.like {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 10px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: #fff;
  color: var(--muted);
  font-size: 0.85rem;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
}

.like:hover {
  border-color: var(--red);
  color: var(--red);
}

.like.liked {
  border-color: var(--red);
  color: var(--red);
}

.like:disabled {
  opacity: 0.6;
  cursor: wait;
}

.heart {
  font-size: 1rem;
  line-height: 1;
}
</style>
