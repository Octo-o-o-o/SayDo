import { cryptoFramework } from '@kit.CryptoArchitectureKit'
import { url } from '@kit.ArkTS'

export const INVALID_PAIRING_URL_MESSAGE: string = '二维码不是 SayDo 桌面配对地址，请重新扫描'

export class DesktopProfile {
  id: string
  name: string
  url: string
  token: string

  constructor(id: string, name: string, url: string, token: string) {
    this.id = id
    this.name = name
    this.url = url
    this.token = token
  }

  authenticatedUrl(): string {
    const parsed = url.URL.parseURL(this.url)
    parsed.params.delete('token')
    parsed.params.append('token', this.token)
    return parsed.toString()
  }

  address(): string {
    const parsed = url.URL.parseURL(this.url)
    return parsed.hostname + ':' + parsed.port
  }

  static fromPairingUrl(value: string): DesktopProfile {
    try {
      const parsed = url.URL.parseURL(value.trim())
      const token = parsed.params.get('token')
      if (parsed.protocol.toLowerCase() !== 'http:' ||
          parsed.hostname.length === 0 ||
          !isIpAddress(parsed.hostname) ||
          parsed.port.length === 0 ||
          parsed.username.length > 0 ||
          parsed.password.length > 0 ||
          parsed.pathname !== '/' ||
          parsed.hash.length > 0 ||
          !hasOnlyOneTokenParameter(parsed) ||
          token === null ||
          token.length === 0) {
        throw new Error(INVALID_PAIRING_URL_MESSAGE)
      }

      parsed.params.delete('token')
      parsed.hash = ''
      return new DesktopProfile(
        generateProfileId(),
        parsed.hostname + ':' + parsed.port,
        parsed.toString(),
        token,
      )
    } catch (_e) {
      throw new Error(INVALID_PAIRING_URL_MESSAGE)
    }
  }
}

function hasOnlyOneTokenParameter(parsed: url.URL): boolean {
  let count = 0
  let onlyToken = true
  parsed.params.forEach((_value: string, key: string): void => {
    count++
    if (key !== 'token') {
      onlyToken = false
    }
  })
  return onlyToken && count === 1
}

function isIpAddress(hostname: string): boolean {
  return isIpv4Address(hostname) || isIpv6Address(hostname)
}

function isIpv4Address(hostname: string): boolean {
  const parts = hostname.split('.')
  if (parts.length !== 4) {
    return false
  }
  for (const part of parts) {
    if (part.length === 0 || (part.length > 1 && part.charAt(0) === '0')) {
      return false
    }
    for (let i = 0; i < part.length; i++) {
      const code = part.charCodeAt(i)
      if (code < 0x30 || code > 0x39) {
        return false
      }
    }
    const value = Number(part)
    if (!Number.isInteger(value) || value < 0 || value > 255) {
      return false
    }
  }
  return true
}

function isIpv6Address(hostname: string): boolean {
  let value = hostname
  if (value.startsWith('[') && value.endsWith(']')) {
    value = value.substring(1, value.length - 1)
  }
  if (value.indexOf(':') < 0 || value.indexOf('.') >= 0) {
    return false
  }
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i)
    const isHex = (code >= 0x30 && code <= 0x39) ||
      (code >= 0x41 && code <= 0x46) ||
      (code >= 0x61 && code <= 0x66)
    if (!isHex && code !== 0x3a) {
      return false
    }
  }

  const compression = value.indexOf('::')
  if (compression >= 0) {
    if (compression !== value.lastIndexOf('::')) {
      return false
    }
    const left = value.substring(0, compression)
    const right = value.substring(compression + 2)
    const leftParts = left.length === 0 ? [] : left.split(':')
    const rightParts = right.length === 0 ? [] : right.split(':')
    return leftParts.length + rightParts.length < 8 &&
      areValidIpv6Parts(leftParts) &&
      areValidIpv6Parts(rightParts)
  }

  const parts = value.split(':')
  return parts.length === 8 && areValidIpv6Parts(parts)
}

function areValidIpv6Parts(parts: Array<string>): boolean {
  for (const part of parts) {
    if (part.length === 0 || part.length > 4) {
      return false
    }
  }
  return true
}

export class DesktopProfileMetadata {
  id: string
  name: string
  url: string

  constructor(id: string, name: string, url: string) {
    this.id = id
    this.name = name
    this.url = url
  }
}

function generateProfileId(): string {
  const bytes = cryptoFramework.createRandom().generateRandomSync(16).data
  let value = ''
  for (let i = 0; i < bytes.length; i++) {
    value += bytes[i].toString(16).padStart(2, '0')
  }
  return value
}
