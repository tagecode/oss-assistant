import { existsSync } from 'fs'
import { basename, extname, join } from 'path'

export function resolveDownloadPath(localDir: string, objectKey: string): string {
  const fileName = basename(objectKey)
  return join(localDir, fileName)
}

export function pathsExist(paths: string[]): boolean[] {
  return paths.map((p) => existsSync(p))
}

export function uniqueDownloadPath(localDir: string, fileName: string): string {
  const ext = extname(fileName)
  const stem = basename(fileName, ext)
  let candidate = join(localDir, fileName)
  let index = 1
  while (existsSync(candidate)) {
    candidate = join(localDir, `${stem} (${index})${ext}`)
    index += 1
  }
  return candidate
}
