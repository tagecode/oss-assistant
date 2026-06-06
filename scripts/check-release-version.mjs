import { readFileSync } from 'fs'

const pkg = JSON.parse(readFileSync('package.json', 'utf-8'))
const ref = process.env.GITHUB_REF ?? ''
const tag = ref.startsWith('refs/tags/') ? ref.slice('refs/tags/'.length) : ''

if (!tag) {
  console.log('Not a tag ref, skip version check')
  process.exit(0)
}

const expected = tag.startsWith('v') ? tag.slice(1) : tag
if (pkg.version !== expected) {
  console.error(
    `package.json version "${pkg.version}" does not match tag "${tag}" (expected "${expected}")`
  )
  process.exit(1)
}

console.log(`Release version OK: ${pkg.version}`)
