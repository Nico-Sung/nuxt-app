<script setup lang="ts">
import type { StatName } from '#shared/types/pokemon'
import { STAT_NAMES } from '#shared/types/pokemon'
import { statLevel, statPercent, totalStats } from '#shared/utils/stats'

const props = defineProps<{
  stats: Readonly<Record<StatName, number>>
}>()

const { t } = useI18n()
const total = computed(() => totalStats(props.stats))
</script>

<template>
  <dl class="stats">
    <div v-for="name in STAT_NAMES" :key="name" class="stat">
      <dt>{{ t(`stats.${name}`) }}</dt>
      <dd>
        <span class="value">{{ stats[name] }}</span>
        <span class="bar" aria-hidden="true">
          <span
            class="fill"
            :class="statLevel(stats[name])"
            :style="{ width: `${statPercent(stats[name])}%` }"
          />
        </span>
      </dd>
    </div>
    <div class="stat total">
      <dt>{{ t('stats.total') }}</dt>
      <dd>
        <span class="value">{{ total }}</span>
      </dd>
    </div>
  </dl>
</template>

<style scoped>
.stats {
  margin: 0;
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
</style>
