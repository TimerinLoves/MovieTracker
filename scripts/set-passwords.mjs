#!/usr/bin/env node
// Generates the password hashes stored in auth-config.json.
// Run:  npm run set-passwords
// Or provide passwords directly: node scripts/set-passwords.mjs <passA> [passB]

import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { createInterface } from 'node:readline'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const configPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'auth-config.json')

function hash(password) {
  return createHash('sha256').update(password).digest('hex')
}

function readConfig() {
  try {
    return JSON.parse(readFileSync(configPath, 'utf8'))
  } catch {
    return { version: 1, users: [{ passwordHash: '' }, { passwordHash: '' }] }
  }
}

function ask(question, hidden = false) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout })
    if (hidden && rl._writeToOutput) {
      rl._writeToOutput = function (str) {
        if (str === question) this.output.write(str)
        else this.output.write('*'.repeat(str.length))
      }
    }
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer)
    })
  })
}

async function main() {
  const args = process.argv.slice(2)
  let passA = args[0]
  let passB = args[1]

  if (!passA) passA = await ask('Password for user 1 (shown as dots): ', true)
  if (!passB) passB = await ask('Password for user 2 (shown as dots): ', true)

  if (!passA || !passB) {
    console.error('Both passwords are required.')
    process.exit(1)
  }

  const config = readConfig()
  config.version = 1
  config.users = [
    { passwordHash: hash(passA) },
    { passwordHash: hash(passB) },
  ]
  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n')
  console.log('auth-config.json updated with hashed passwords.')
  console.log('NOTE: never put the plaintext passwords in this repo.')
}

main()