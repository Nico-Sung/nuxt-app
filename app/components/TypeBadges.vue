<script setup lang="ts">
import type { PokemonTypeName } from '#shared/types/pokemon'
import { typeColor } from '#shared/utils/types'

const props = defineProps<{
  types: readonly PokemonTypeName[]
}>()

const { t } = useI18n()

const badges = computed(() =>
  props.types.map((name) => ({
    name,
    label: t(`types.${name}`),
    color: typeColor(name),
  })),
)
</script>

<template>
  <ul class="types" :aria-label="t('types.label')">
    <li
      v-for="type in badges"
      :key="type.name"
      class="type"
      :style="{ background: type.color }"
    >
      {{ type.label }}
    </li>
  </ul>
</template>

<style scoped>
.types {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin: 0;
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
</style>
