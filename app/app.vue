<script setup lang="ts">
const { t, locale } = useI18n()

// Langue de la page et titre par défaut, mis à jour quand la langue change.
useHead({
  htmlAttrs: { lang: locale },
  title: () => t('app.title'),
})
</script>

<template>
  <div>
    <NuxtRouteAnnouncer />
    <NuxtPage />
  </div>
</template>
