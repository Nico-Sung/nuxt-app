import { describe, expect, it } from 'vitest'
import {
  compare,
  differences,
  MIN_VISIBLE_TEXT,
  pageProblems,
  readPage,
} from '../scripts/compare-ssr-ssg.mjs'

const DESCRIPTION =
  'Il lui arrive de remettre sur pied un Pikachu allié en lui envoyant une décharge électrique. Il stocke l’électricité dans ses joues et la libère quand il se sent menacé par un adversaire.'

/** Fiche telle que Nuxt la rend (données dupliquées dans un <script>). */
function fiche({
  title = 'Pikachu · Pokémon à capturer',
  total = '320',
  body = true,
} = {}) {
  const content = body
    ? `<h1 data-v-1>Pikachu</h1><p class="num" data-v-1>#025</p>
       <p class="genus" data-v-1>Pokémon Souris</p>
       <ul class="types" data-v-2><li class="type" style="background:#d4a90c" data-v-2>Électrik</li></ul>
       <p class="description" data-v-1>${DESCRIPTION}</p>
       <ul class="abilities" data-v-1><li data-v-1>Statik <!----></li><li data-v-1>Paratonnerre <span class="hidden">(caché)</span></li></ul>
       <dl class="stats"><div class="stat total"><dt>Total</dt><dd><span class="value">${total}</span></dd></div></dl>`
    : ''
  return `<!DOCTYPE html><html lang="fr"><head><title>${title}</title></head><body>
    <div id="__nuxt">${content}</div>
    <script type="application/json" id="__NUXT_DATA__">["Pikachu","Statik","Paratonnerre","${DESCRIPTION}",320]</script>
  </body></html>`
}

describe('readPage : ce qu’un client sans JavaScript lit', () => {
  it('extrait titre, h1, numéro, catégorie, types, talents, total', () => {
    const page = readPage(fiche())
    expect(page).toMatchObject({
      lang: 'fr',
      title: 'Pikachu · Pokémon à capturer',
      h1: 'Pikachu',
      number: '#025',
      genus: 'Pokémon Souris',
      description: DESCRIPTION,
      types: ['Électrik'],
      abilities: ['Statik', 'Paratonnerre (caché)'],
      total: '320',
    })
    expect(page.visibleText).toBeGreaterThan(MIN_VISIBLE_TEXT)
  })

  it('ignore les données des <script> : une coquille reste vide', () => {
    const page = readPage(fiche({ body: false }))
    expect(page.visibleText).toBe(0)
    expect(page.h1).toBeNull()
  })
})

describe('pageProblems', () => {
  it('vraie fiche : aucun problème', () => {
    expect(pageProblems(readPage(fiche()), { id: 25 })).toEqual([])
  })

  it('coquille vide : signalée', () => {
    expect(pageProblems(readPage(fiche({ body: false })), { id: 25 })[0]).toBe(
      'coquille vide : 0 caractères visibles',
    )
  })

  it('mauvais titre : signalé', () => {
    expect(
      pageProblems(readPage(fiche({ title: 'Pokémon à capturer' })), {
        id: 25,
      }),
    ).toEqual([
      'title « Pokémon à capturer », attendu « Pikachu · Pokémon à capturer »',
    ])
  })
})

describe('SSR / SSG', () => {
  it('mêmes informations : aucune différence', () => {
    expect(differences(readPage(fiche()), readPage(fiche()))).toEqual([])
  })

  it('information différente : signalée', () => {
    expect(
      differences(readPage(fiche()), readPage(fiche({ total: '999' }))),
    ).toEqual(['total : SSR "320" ≠ SSG "999"'])
  })

  it('compare : SSR complet, SSG coquille vide -> problèmes sur le SSG', async () => {
    const fakeFetch = (async (url: string) =>
      new Response(
        url.startsWith('https://ssr') ? fiche() : fiche({ body: false }),
        {
          headers: { 'content-type': 'text/html' },
        },
      )) as unknown as typeof fetch

    const [result] = await compare({
      ssr: 'https://ssr.test',
      ssg: 'https://ssg.test',
      fetch: fakeFetch,
      pokemon: [{ id: 25, slug: 'pikachu' }],
    })

    expect(result?.problems).toContain(
      'SSG : coquille vide : 0 caractères visibles',
    )
    expect(result?.problems.some((p) => p.startsWith('SSR'))).toBe(false)
    expect(result?.problems).toContain('h1 : SSR "Pikachu" ≠ SSG null')
  })
})
