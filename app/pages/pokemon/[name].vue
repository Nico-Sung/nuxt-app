<script setup lang="ts">
import type { PokemonProfile } from '#shared/types/pokemon'
import { formatHeight, formatNumber, formatWeight } from '#shared/utils/format'
import { smallSpriteUrl } from '#shared/utils/pokeapi'
import { typeColor } from '#shared/utils/types'

definePageMeta({
  // Une seule URL par Pokémon : /pokemon/Pikachu -> /pokemon/pikachu (301).
  middleware: (to) => {
    const name = String(to.params.name)
    if (name !== name.toLowerCase()) {
      return navigateTo(`/pokemon/${name.toLowerCase()}`, { redirectCode: 301 })
    }
  },
})

const { t, locale } = useI18n()
const route = useRoute()
const slug = computed(() => String(route.params.name))

// Rendu côté serveur : une URL ouverte directement arrive déjà remplie.
// Description et catégorie dans la langue choisie (rechargées si elle change).
const profileUrl = computed(
  () => `/api/pokemon/profile/${encodeURIComponent(slug.value)}`,
)

// Rendu côté serveur (ou page générée au build, en français) : la fiche
// arrive déjà remplie.
const { data: pokemon, error } = await useFetch<PokemonProfile>(profileUrl, {
  key: `pokemon-profile-${slug.value}`,
  query: { lang: locale.value },
})

if (error.value || !pokemon.value) {
  // 404 (inconnu) ou 502 (PokéAPI en panne) : page d'erreur, vrai statut HTTP.
  throw createError({
    statusCode: error.value?.statusCode ?? 502,
    statusMessage: error.value?.statusMessage,
    // pour la page d'erreur : « Aucun Pokémon ne s'appelle … »
    data: { pokemon: slug.value },
    fatal: true,
  })
}

const profile = computed(() => pokemon.value!)

/**
 * Fiche dans la langue du visiteur : une page générée au build est en
 * français ; un visiteur anglophone (ou un clic sur EN) recharge nom,
 * talents et description. En cas d'échec, la fiche affichée reste.
 */
async function loadInVisitorLanguage() {
  if (!pokemon.value || pokemon.value.lang === locale.value) return
  try {
    pokemon.value = await $fetch<PokemonProfile>(profileUrl.value, {
      query: { lang: locale.value },
    })
  } catch {
    // PokéAPI indisponible : on garde la version déjà affichée.
  }
}
onMounted(loadInVisitorLanguage)
watch(locale, loadInVisitorLanguage)
const mainColor = computed(() => typeColor(profile.value.types[0] ?? 'normal'))

useHead({
  title: () =>
    t('app.pageTitle', { title: profile.value.name, app: t('app.title') }),
})

const imageState = ref<'artwork' | 'small' | 'missing'>('artwork')
const imageSrc = computed(() =>
  imageState.value === 'artwork'
    ? profile.value.sprite
    : smallSpriteUrl(profile.value.id),
)
function onImageError() {
  imageState.value = imageState.value === 'artwork' ? 'small' : 'missing'
}
</script>

<template>
  <div>
    <AppHeader />

    <main class="main">
      <NuxtLink to="/" class="back">{{ t('profile.back') }}</NuxtLink>

      <article class="profile" :style="{ '--type-color': mainColor }">
        <div class="art">
          <img
            v-if="imageState !== 'missing'"
            :src="imageSrc"
            :alt="profile.name"
            width="320"
            height="320"
            @error="onImageError"
          />
        </div>

        <div class="info">
          <p class="num">{{ formatNumber(profile.id) }}</p>
          <h1>{{ profile.name }}</h1>
          <p v-if="profile.genus" class="genus">{{ profile.genus }}</p>
          <TypeBadges class="types" :types="profile.types" />

          <p v-if="profile.description" class="description">
            {{ profile.description }}
          </p>

          <dl class="facts">
            <div>
              <dt>{{ t('profile.height') }}</dt>
              <dd>{{ formatHeight(profile.height, locale) }}</dd>
            </div>
            <div>
              <dt>{{ t('profile.weight') }}</dt>
              <dd>{{ formatWeight(profile.weight, locale) }}</dd>
            </div>
            <div v-if="profile.abilities.length">
              <dt>{{ t('profile.abilities') }}</dt>
              <dd>
                <ul class="abilities">
                  <li v-for="ability in profile.abilities" :key="ability.name">
                    {{ ability.name }}
                    <span v-if="ability.hidden" class="hidden">{{
                      t('profile.hidden')
                    }}</span>
                  </li>
                </ul>
              </dd>
            </div>
          </dl>

          <section class="stats" aria-labelledby="stats-title">
            <h2 id="stats-title">{{ t('profile.baseStats') }}</h2>
            <StatBars :stats="profile.stats" />
          </section>
        </div>
      </article>
    </main>
  </div>
</template>

<style scoped>
.main {
  max-width: 900px;
  margin: 0 auto;
  padding: 24px clamp(16px, 4vw, 32px) 48px;
}

.back {
  display: inline-block;
  margin-bottom: 16px;
  color: var(--muted);
  font-size: 0.9rem;
  text-decoration: none;
}

.back:hover {
  color: var(--red);
  text-decoration: underline;
}

.profile {
  display: grid;
  grid-template-columns: minmax(0, 320px) minmax(0, 1fr);
  background: #fff;
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow: hidden;
}

.art {
  padding: 24px;
  background: color-mix(in srgb, var(--type-color) 14%, #fff);
  border-right: 1px solid color-mix(in srgb, var(--type-color) 25%, #fff);
}

.art img {
  display: block;
  width: 100%;
  height: auto;
  aspect-ratio: 1;
  object-fit: contain;
}

.info {
  padding: 20px 24px 24px;
}

.num {
  margin: 0;
  color: var(--muted);
  font-size: 0.9rem;
  font-variant-numeric: tabular-nums;
}

h1 {
  margin: 0;
  font-size: 1.75rem;
  overflow-wrap: anywhere;
}

.genus {
  margin: 2px 0 0;
  color: var(--muted);
}

.types {
  margin-top: 10px;
}

.description {
  margin: 16px 0 0;
  max-width: 60ch;
}

.facts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 12px;
  margin: 20px 0 0;
  padding: 12px 0;
  border-block: 1px solid var(--border);
}

.facts dt {
  color: var(--muted);
  font-size: 0.8rem;
}

.facts dd {
  margin: 2px 0 0;
  font-weight: 600;
}

.abilities {
  margin: 0;
  padding: 0;
  list-style: none;
}

.hidden {
  color: var(--muted);
  font-weight: 400;
}

.stats {
  margin-top: 20px;
}

h2 {
  margin: 0 0 10px;
  font-size: 1rem;
  font-weight: 600;
}

@media (max-width: 640px) {
  .profile {
    grid-template-columns: 1fr;
  }

  .art {
    border-right: 0;
    border-bottom: 1px solid color-mix(in srgb, var(--type-color) 25%, #fff);
  }

  .art img {
    max-width: 240px;
    margin: 0 auto;
  }
}
</style>
