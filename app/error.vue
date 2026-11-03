<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps<{ error: NuxtError }>()

/**
 * Nom demandé, transmis par la page /pokemon/[name] dans `error.data`.
 * Rendue côté serveur, l'erreur arrive sérialisée : data est alors une chaîne JSON.
 */
const requestedName = computed((): string | null => {
  let data: unknown = props.error.data
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data)
    } catch {
      return null
    }
  }
  const name = (data as { pokemon?: unknown } | null | undefined)?.pokemon
  return typeof name === 'string' && name ? name : null
})

const kind = computed(() => {
  if (props.error.statusCode === 404) {
    return requestedName.value ? 'pokemon-not-found' : 'page-not-found'
  }
  if (props.error.statusCode === 502) return 'pokeapi-down'
  return 'unexpected'
})

// Textes choisis selon le statut : le message HTTP perd ses accents.
const TITLES = {
  'pokemon-not-found': 'Pokémon introuvable',
  'page-not-found': 'Page introuvable',
  'pokeapi-down': 'PokéAPI indisponible',
  unexpected: 'Erreur inattendue',
} as const

const title = computed(() => TITLES[kind.value])

useHead({ title: () => `${title.value} · Pokémon à capturer` })

const goHome = () => clearError({ redirect: '/' })
const route = useRoute()
const retry = () => reloadNuxtApp({ path: route.fullPath, ttl: 0 })
</script>

<template>
  <div>
    <header class="header">
      <NuxtLink to="/" class="brand" @click.prevent="goHome"
        >Pokémon à capturer</NuxtLink
      >
    </header>

    <main class="main">
      <p class="code">Erreur {{ error.statusCode }}</p>
      <h1>{{ title }}</h1>

      <p v-if="kind === 'pokemon-not-found'">
        Aucun Pokémon ne s’appelle « {{ requestedName }} ». Vérifie
        l’orthographe du nom dans l’adresse.
      </p>
      <p v-else-if="kind === 'page-not-found'">Cette page n’existe pas.</p>
      <p v-else-if="kind === 'pokeapi-down'">
        PokéAPI ne répond pas pour le moment. Réessaie dans un instant.
      </p>
      <p v-else>Quelque chose s’est mal passé.</p>

      <div class="actions">
        <button
          v-if="kind === 'pokeapi-down' || kind === 'unexpected'"
          type="button"
          class="primary"
          @click="retry"
        >
          Réessayer
        </button>
        <button type="button" class="link" @click="goHome">
          Retour à ma liste
        </button>
      </div>
    </main>
  </div>
</template>

<style scoped>
.header {
  padding: 16px clamp(16px, 4vw, 32px);
  background: var(--red);
  border-bottom: 4px solid var(--ink);
}

.brand {
  color: #fff;
  font-size: 1.5rem;
  font-weight: 700;
  text-decoration: none;
}

.main {
  max-width: 640px;
  margin: 0 auto;
  padding: 48px clamp(16px, 4vw, 32px);
}

.code {
  margin: 0;
  color: var(--muted);
  font-size: 0.9rem;
}

h1 {
  margin: 4px 0 12px;
  font-size: 1.6rem;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;
  margin-top: 24px;
}

.primary {
  padding: 8px 16px;
  border: 0;
  border-radius: 6px;
  background: var(--red);
  color: #fff;
  font-weight: 600;
  cursor: pointer;
}

.link {
  padding: 0;
  border: 0;
  background: none;
  color: var(--ink);
  text-decoration: underline;
  cursor: pointer;
}

.link:hover {
  color: var(--red);
}
</style>
