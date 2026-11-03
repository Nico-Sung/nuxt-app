<script setup lang="ts">
const { t, locale, locales, setLocale } = useI18n()
</script>

<template>
  <div class="switcher" role="group" :aria-label="t('language.label')">
    <button
      v-for="item in locales"
      :key="item.code"
      type="button"
      class="option"
      :lang="item.language"
      :aria-label="item.name"
      :aria-pressed="locale === item.code"
      @click="setLocale(item.code)"
    >
      {{ item.code.toUpperCase() }}
    </button>
  </div>
</template>

<style scoped>
.switcher {
  display: flex;
  gap: 2px;
}

.option {
  padding: 2px 6px;
  border: 0;
  border-radius: 4px;
  background: none;
  color: rgb(255 255 255 / 0.75);
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
}

.option:hover {
  color: #fff;
}

.option[aria-pressed='true'] {
  background: rgb(255 255 255 / 0.2);
  color: #fff;
}

.option:focus-visible {
  outline-color: #fff;
}
</style>
