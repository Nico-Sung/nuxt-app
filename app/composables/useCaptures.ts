const STORAGE_KEY = 'pokemon-captures'

function readStorage(): number[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((n): n is number => typeof n === 'number') : []
  }
  catch {
    return []
  }
}

export function useCaptures() {
  const captured = useState<number[]>('captures', () => [])

  if (import.meta.client) {
    onMounted(() => {
      captured.value = readStorage()
      watch(captured, (value) => {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
        }
        catch {
          // stockage indisponible (navigation privée, quota) : on ignore
        }
      }, { deep: true })
    })
  }

  return {
    captured: readonly(captured),
    isCaptured: (id: number) => captured.value.includes(id),
    toggle: (id: number) => { captured.value = toggleCapture(captured.value, id) },
    reset: () => { captured.value = [] },
  }
}
