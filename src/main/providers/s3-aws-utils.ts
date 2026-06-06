function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error && 'message' in error) {
    return String((error as { message?: unknown }).message)
  }
  return String(error)
}

export function normalizeAwsBucketRegion(location?: string | null): string {
  if (!location) return 'us-east-1'
  if (location === 'EU') return 'eu-west-1'
  return location
}

export function regionFromS3Endpoint(endpoint: string): string | undefined {
  const host = endpoint
    .replace(/^https?:\/\//, '')
    .split('/')[0]
    ?.toLowerCase()
  if (!host) return undefined

  const patterns = [
    /\.s3[.-]([a-z0-9-]+)\.amazonaws\.com$/,
    /^s3[.-]([a-z0-9-]+)\.amazonaws\.com$/,
    /^s3\.dualstack\.([a-z0-9-]+)\.amazonaws\.com$/
  ]

  for (const pattern of patterns) {
    const match = host.match(pattern)
    const region = match?.[1]
    if (region && region !== 'amazonaws') {
      return normalizeAwsBucketRegion(region)
    }
  }

  return undefined
}

export function extractAwsBucketRegionFromError(error: unknown): string | undefined {
  const err = error as {
    BucketRegion?: string
    Endpoint?: string
    message?: string
    $response?: { headers?: Record<string, string> }
  }

  const headers = err.$response?.headers ?? {}
  const headerRegion =
    headers['x-amz-bucket-region'] ?? headers['X-Amz-Bucket-Region'] ?? err.BucketRegion
  if (headerRegion) {
    return normalizeAwsBucketRegion(headerRegion)
  }

  const endpoint = err.Endpoint ?? err.message?.match(/<Endpoint>([^<]+)<\/Endpoint>/i)?.[1]?.trim()
  if (endpoint) {
    return regionFromS3Endpoint(endpoint)
  }

  return undefined
}

export function isAwsBucketEndpointError(error: unknown): boolean {
  const message = getErrorMessage(error)
  const code =
    typeof error === 'object' && error && 'Code' in error
      ? String((error as { Code?: unknown }).Code)
      : typeof error === 'object' && error && 'name' in error
        ? String((error as { name?: unknown }).name)
        : ''

  return /must be addressed using the specified endpoint|PermanentRedirect|IllegalLocationConstraint/i.test(
    `${code} ${message}`
  )
}
