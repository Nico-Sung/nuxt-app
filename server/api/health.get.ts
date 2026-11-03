export interface FrontHealthResponse {
  status: 'ok'
  version: string
  commit: string
}

/** Version en ligne du front : le commit est celui du build (GITHUB_SHA en CI). */
export default defineEventHandler((event): FrontHealthResponse => {
  const { appVersion, appCommit } = useRuntimeConfig(event)
  return { status: 'ok', version: appVersion, commit: appCommit }
})
