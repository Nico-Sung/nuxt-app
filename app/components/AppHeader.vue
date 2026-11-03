<script setup lang="ts">
defineProps<{
  /** Page d'accueil : le titre de l'app est le h1 (ailleurs, un lien vers l'accueil). */
  home?: boolean
}>()

const { t } = useI18n()
</script>

<template>
  <header class="header">
    <h1 v-if="home" class="brand">{{ t('app.title') }}</h1>
    <NuxtLink v-else to="/" class="brand">{{ t('app.title') }}</NuxtLink>
    <div class="end">
      <slot />
      <LanguageSwitcher />
    </div>
  </header>
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

.brand {
  margin: 0;
  color: #fff;
  font-size: 1.5rem;
  font-weight: 700;
  text-decoration: none;
}

.end {
  display: flex;
  align-items: center;
  gap: 12px;
}
</style>
