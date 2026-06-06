import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { testUserData } from '../../setup'
import {
  pathsExist,
  resolveDownloadPath,
  uniqueDownloadPath
} from '../../../src/main/services/path-utils'

describe('path-utils', () => {
  const dir = join(testUserData, 'path-utils')

  afterEach(() => {
    // files are isolated per test name under dir
  })

  it('resolves download path from object key', () => {
    expect(resolveDownloadPath(dir, 'folder/file.txt')).toContain('file.txt')
  })

  it('detects existing paths', () => {
    mkdirSync(dir, { recursive: true })
    const filePath = join(dir, 'exists.txt')
    writeFileSync(filePath, 'ok')
    expect(pathsExist([filePath, join(dir, 'missing.txt')])).toEqual([true, false])
    expect(existsSync(filePath)).toBe(true)
  })

  it('generates unique path when file exists', () => {
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'dup.txt'), '1')
    const unique = uniqueDownloadPath(dir, 'dup.txt')
    expect(unique).not.toBe(join(dir, 'dup.txt'))
    expect(unique).toContain('dup (1).txt')
  })
})
