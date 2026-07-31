type DevelopmentEnvironment = Record<string, string | undefined>

function port(value: string | undefined, fallback: number) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 65_535 ? parsed : fallback
}

export function resolveDevServerConfig(environment: DevelopmentEnvironment) {
  const apiPort = port(environment.PORT, 3000)
  return {
    apiTarget: environment.API_PROXY_TARGET?.trim() || `http://127.0.0.1:${apiPort}`,
    webPort: port(environment.WEB_PORT, 5173),
  }
}
