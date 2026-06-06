const SECRET_PATTERNS = [
  /(?:secret|password|token|authorization|signature)[\s"':=]*["']?([A-Za-z0-9+/=_-]{8,})/gi,
  /AKIA[0-9A-Z]{16}/g,
  /(?:access[_-]?key[_-]?secret|secret[_-]?key)[\s"':=]*["']?([A-Za-z0-9+/=_-]{8,})/gi
]

export function redactSensitiveText(text: string): string {
  let result = text
  for (const pattern of SECRET_PATTERNS) {
    result = result.replace(pattern, (match) => {
      if (match.length <= 8) return '***'
      return `${match.slice(0, 4)}***${match.slice(-2)}`
    })
  }
  return result
}

export function redactObject<T>(value: T): T {
  if (typeof value === 'string') {
    return redactSensitiveText(value) as T
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactObject(item)) as T
  }
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(value)) {
      if (/secret|password|token|authorization|accesskey/i.test(key)) {
        result[key] = '***REDACTED***'
      } else {
        result[key] = redactObject(val)
      }
    }
    return result as T
  }
  return value
}
