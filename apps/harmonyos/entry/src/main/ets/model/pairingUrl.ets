export const INVALID_PAIRING_URL_MESSAGE: string = '二维码不是 SayDo 桌面配对地址，请重新扫描'

export class ParsedPairingUrl {
  host: string
  port: string
  token: string

  constructor(host: string, port: string, token: string) {
    this.host = host
    this.port = port
    this.token = token
  }

  get name(): string {
    return this.host + ':' + this.port
  }

  get baseUrl(): string {
    return 'http://' + formatHost(this.host) + ':' + this.port + '/'
  }
}

export function parsePairingUrl(value: string): ParsedPairingUrl {
  const parsed = parseLanHttpUrl(value, true)
  return new ParsedPairingUrl(parsed.host, parsed.port, parsed.token)
}

export function authenticatedPairingUrl(baseUrl: string, token: string): string {
  const parsed = parseLanHttpUrl(baseUrl, false)
  return parsed.baseUrl + '?token=' + percentEncode(token)
}

export function lanAddressFromHttpUrl(url: string): string {
  const parsed = parseLanHttpUrl(url, false)
  return parsed.name
}

class LanHttpUrl {
  host: string
  port: string
  token: string

  constructor(host: string, port: string, token: string) {
    this.host = host
    this.port = port
    this.token = token
  }

  get name(): string {
    return this.host + ':' + this.port
  }

  get baseUrl(): string {
    return 'http://' + formatHost(this.host) + ':' + this.port + '/'
  }
}

function parseLanHttpUrl(value: string, requireToken: boolean): LanHttpUrl {
  const trimmed = asciiTrim(value)
  if (!startsWithIgnoreCase(trimmed, 'http://') || startsWithIgnoreCase(trimmed, 'https://')) {
    throw new Error(INVALID_PAIRING_URL_MESSAGE)
  }
  const rest = trimmed.substring(7)
  if (rest.indexOf('@') >= 0 || rest.indexOf('#') >= 0) {
    throw new Error(INVALID_PAIRING_URL_MESSAGE)
  }
  assertRawAsciiAuthority(rest)

  const split = splitAuthority(rest)
  const hostPort = parseHostPort(split.authority)
  if (!isPrivateLanHost(hostPort.host)) {
    throw new Error(INVALID_PAIRING_URL_MESSAGE)
  }
  if (split.path !== '/' && split.path !== '') {
    throw new Error(INVALID_PAIRING_URL_MESSAGE)
  }

  const token = uniqueToken(split.query, requireToken)
  return new LanHttpUrl(hostPort.host, hostPort.port, token)
}

class HostPort {
  host: string
  port: string

  constructor(host: string, port: string) {
    this.host = host
    this.port = port
  }
}

class AuthoritySplit {
  authority: string
  path: string
  query: string

  constructor(authority: string, path: string, query: string) {
    this.authority = authority
    this.path = path
    this.query = query
  }
}

function splitAuthority(rest: string): AuthoritySplit {
  let cursor = 0
  if (rest.startsWith('[')) {
    const close = rest.indexOf(']')
    if (close < 0) {
      throw new Error(INVALID_PAIRING_URL_MESSAGE)
    }
    cursor = close + 1
  }
  while (cursor < rest.length && rest.charAt(cursor) !== '/' && rest.charAt(cursor) !== '?') {
    cursor++
  }
  const authority = rest.substring(0, cursor)
  let remainder = rest.substring(cursor)
  let path = ''
  let query = ''
  const queryIndex = remainder.indexOf('?')
  if (queryIndex >= 0) {
    path = remainder.substring(0, queryIndex)
    query = remainder.substring(queryIndex + 1)
  } else {
    path = remainder
  }
  if (path.length === 0) {
    path = ''
  }
  return new AuthoritySplit(authority, path, query)
}

function parseHostPort(authority: string): HostPort {
  if (authority.startsWith('[')) {
    const close = authority.indexOf(']')
    if (close < 2) {
      throw new Error(INVALID_PAIRING_URL_MESSAGE)
    }
    const host = authority.substring(1, close)
    if (authority.substring(close + 1, close + 2) !== ':') {
      throw new Error(INVALID_PAIRING_URL_MESSAGE)
    }
    const port = normalizePort(authority.substring(close + 2))
    if (!isUniqueLocalIpv6(host)) {
      throw new Error(INVALID_PAIRING_URL_MESSAGE)
    }
    return new HostPort(host, port)
  }
  const colon = authority.indexOf(':')
  if (colon <= 0 || colon !== authority.lastIndexOf(':') || colon === authority.length - 1) {
    throw new Error(INVALID_PAIRING_URL_MESSAGE)
  }
  const host = authority.substring(0, colon)
  const port = normalizePort(authority.substring(colon + 1))
  if (!isRfc1918Ipv4(host)) {
    throw new Error(INVALID_PAIRING_URL_MESSAGE)
  }
  return new HostPort(host, port)
}

function uniqueToken(query: string, required: boolean): string {
  if (query.length === 0) {
    if (required) {
      throw new Error(INVALID_PAIRING_URL_MESSAGE)
    }
    return ''
  }
  const parts = query.split('&')
  let token: string | null = null
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]
    const separator = part.indexOf('=')
    if (separator <= 0 || part.length === 0) {
      throw new Error(INVALID_PAIRING_URL_MESSAGE)
    }
    const rawName = part.substring(0, separator)
    const rawValue = part.substring(separator + 1)
    assertRawQueryAtom(rawName)
    assertRawQueryAtom(rawValue)
    const name = percentDecode(rawName)
    const value = percentDecode(rawValue)
    if (name !== 'token') {
      throw new Error(INVALID_PAIRING_URL_MESSAGE)
    }
    if (token !== null || value.length === 0) {
      throw new Error(INVALID_PAIRING_URL_MESSAGE)
    }
    token = value
  }
  if (token === null) {
    throw new Error(INVALID_PAIRING_URL_MESSAGE)
  }
  return token
}

function isPrivateLanHost(host: string): boolean {
  return isRfc1918Ipv4(host) || isUniqueLocalIpv6(host)
}

function isRfc1918Ipv4(host: string): boolean {
  if (!isIpv4Address(host)) {
    return false
  }
  const parts = host.split('.')
  const first = Number(parts[0])
  const second = Number(parts[1])
  if (first === 10) {
    return true
  }
  if (first === 192 && second === 168) {
    return true
  }
  if (first === 172 && second >= 16 && second <= 31) {
    return true
  }
  return false
}

function isIpv4Address(host: string): boolean {
  const parts = host.split('.')
  if (parts.length !== 4) {
    return false
  }
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]
    if (part.length === 0 || (part.length > 1 && part.charAt(0) === '0')) {
      return false
    }
    for (let j = 0; j < part.length; j++) {
      const code = part.charCodeAt(j)
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

function isUniqueLocalIpv6(host: string): boolean {
  if (!isIpv6Address(host)) {
    return false
  }
  const end = host.indexOf(':')
  if (end <= 0) {
    return false
  }
  const first = parseHextet(host.substring(0, end))
  return first >= 0xfc00 && first <= 0xfdff
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
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]
    if (part.length === 0 || part.length > 4) {
      return false
    }
  }
  return true
}

function parseHextet(part: string): number {
  if (part.length === 0 || part.length > 4) {
    return -1
  }
  let value = 0
  for (let i = 0; i < part.length; i++) {
    const digit = hexDigit(part.charAt(i))
    if (digit < 0) {
      return -1
    }
    value = value * 16 + digit
  }
  return value
}

function normalizePort(port: string): string {
  if (port.length === 0) {
    throw new Error(INVALID_PAIRING_URL_MESSAGE)
  }
  for (let i = 0; i < port.length; i++) {
    const code = port.charCodeAt(i)
    if (code < 0x30 || code > 0x39) {
      throw new Error(INVALID_PAIRING_URL_MESSAGE)
    }
  }
  const value = Number(port)
  if (!Number.isInteger(value) || value < 1 || value > 65535) {
    throw new Error(INVALID_PAIRING_URL_MESSAGE)
  }
  return String(value)
}

function formatHost(host: string): string {
  if (host.indexOf(':') >= 0) {
    return '[' + host + ']'
  }
  return host
}

function assertRawAsciiAuthority(rest: string): void {
  let index = 0
  let inBrackets = false
  let sawChar = false
  while (index < rest.length) {
    const cp = rest.charCodeAt(index)
    if (!inBrackets && (cp === 0x2f || cp === 0x3f)) {
      break
    }
    if (cp < 0x21 || cp > 0x7e) {
      throw new Error(INVALID_PAIRING_URL_MESSAGE)
    }
    sawChar = true
    if (cp === 0x5b) {
      inBrackets = true
    }
    if (cp === 0x5d) {
      inBrackets = false
    }
    index += 1
  }
  if (!sawChar) {
    throw new Error(INVALID_PAIRING_URL_MESSAGE)
  }
}

function asciiTrim(value: string): string {
  let start = 0
  let end = value.length
  while (start < end && isAsciiWs(value.charCodeAt(start))) {
    start++
  }
  while (end > start && isAsciiWs(value.charCodeAt(end - 1))) {
    end--
  }
  return value.substring(start, end)
}

function isAsciiWs(code: number): boolean {
  return code === 0x20 || code === 0x09 || code === 0x0d || code === 0x0a
}

function isUnreservedCode(code: number): boolean {
  return (code >= 0x41 && code <= 0x5a) ||
    (code >= 0x61 && code <= 0x7a) ||
    (code >= 0x30 && code <= 0x39) ||
    code === 0x2d || code === 0x2e || code === 0x5f || code === 0x7e
}

function assertRawQueryAtom(raw: string): void {
  if (raw.length === 0) {
    throw new Error(INVALID_PAIRING_URL_MESSAGE)
  }
  let index = 0
  while (index < raw.length) {
    const code = raw.charCodeAt(index)
    if (code === 0x25) {
      if (index + 2 >= raw.length) {
        throw new Error(INVALID_PAIRING_URL_MESSAGE)
      }
      const hex = raw.substring(index + 1, index + 3)
      if (parseHexByte(hex) < 0) {
        throw new Error(INVALID_PAIRING_URL_MESSAGE)
      }
      index += 3
      continue
    }
    if (!isUnreservedCode(code)) {
      throw new Error(INVALID_PAIRING_URL_MESSAGE)
    }
    index += 1
  }
}

function startsWithIgnoreCase(value: string, prefix: string): boolean {
  if (value.length < prefix.length) {
    return false
  }
  return value.substring(0, prefix.length).toLowerCase() === prefix
}

export function percentEncode(value: string): string {
  const bytes = utf8Bytes(value)
  let out = ''
  for (let i = 0; i < bytes.length; i++) {
    const unsigned = bytes[i]
    if (isUnreserved(unsigned)) {
      out += String.fromCharCode(unsigned)
    } else {
      out += '%' + hexByte(unsigned)
    }
  }
  return out
}

export function percentDecode(value: string): string {
  const bytes: Array<number> = []
  let index = 0
  while (index < value.length) {
    const current = value.charAt(index)
    if (current === '%') {
      if (index + 2 >= value.length) {
        throw new Error(INVALID_PAIRING_URL_MESSAGE)
      }
      const hex = value.substring(index + 1, index + 3)
      const decoded = parseHexByte(hex)
      if (decoded < 0) {
        throw new Error(INVALID_PAIRING_URL_MESSAGE)
      }
      bytes.push(decoded)
      index += 3
      continue
    }
    const code = value.charCodeAt(index)
    if (!isUnreservedCode(code)) {
      throw new Error(INVALID_PAIRING_URL_MESSAGE)
    }
    bytes.push(code)
    index += 1
  }
  return utf8FromBytes(bytes)
}

function isUnreserved(unsigned: number): boolean {
  const character = String.fromCharCode(unsigned)
  return (character >= 'a' && character <= 'z') ||
    (character >= 'A' && character <= 'Z') ||
    (character >= '0' && character <= '9') ||
    character === '-' || character === '.' || character === '_' || character === '~'
}

function parseHexByte(hex: string): number {
  if (hex.length !== 2) {
    return -1
  }
  const high = hexDigit(hex.charAt(0))
  const low = hexDigit(hex.charAt(1))
  if (high < 0 || low < 0) {
    return -1
  }
  return high * 16 + low
}

function hexDigit(character: string): number {
  const code = character.charCodeAt(0)
  if (code >= 0x30 && code <= 0x39) {
    return code - 0x30
  }
  if (code >= 0x41 && code <= 0x46) {
    return code - 0x41 + 10
  }
  if (code >= 0x61 && code <= 0x66) {
    return code - 0x61 + 10
  }
  return -1
}

function hexByte(unsigned: number): string {
  const alphabet = '0123456789ABCDEF'
  return alphabet.charAt((unsigned >> 4) & 0xf) + alphabet.charAt(unsigned & 0xf)
}

function utf8Bytes(value: string): Array<number> {
  const bytes: Array<number> = []
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i)
    if (code < 0x80) {
      bytes.push(code)
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6))
      bytes.push(0x80 | (code & 0x3f))
    } else if (code >= 0xd800 && code <= 0xdbff) {
      if (i + 1 >= value.length) {
        throw new Error(INVALID_PAIRING_URL_MESSAGE)
      }
      const low = value.charCodeAt(i + 1)
      if (low < 0xdc00 || low > 0xdfff) {
        throw new Error(INVALID_PAIRING_URL_MESSAGE)
      }
      const full = 0x10000 + ((code - 0xd800) << 10) + (low - 0xdc00)
      bytes.push(0xf0 | (full >> 18))
      bytes.push(0x80 | ((full >> 12) & 0x3f))
      bytes.push(0x80 | ((full >> 6) & 0x3f))
      bytes.push(0x80 | (full & 0x3f))
      i++
      continue
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      throw new Error(INVALID_PAIRING_URL_MESSAGE)
    } else {
      bytes.push(0xe0 | (code >> 12))
      bytes.push(0x80 | ((code >> 6) & 0x3f))
      bytes.push(0x80 | (code & 0x3f))
    }
  }
  return bytes
}

function isContinuation(byte: number): boolean {
  return (byte & 0xc0) === 0x80
}

function appendCodePoint(out: string, codePoint: number): string {
  if (codePoint <= 0xffff) {
    return out + String.fromCharCode(codePoint)
  }
  const minus = codePoint - 0x10000
  return out + String.fromCharCode(0xd800 + (minus >> 10)) + String.fromCharCode(0xdc00 + (minus & 0x3ff))
}

function utf8FromBytes(bytes: Array<number>): string {
  let out = ''
  let i = 0
  while (i < bytes.length) {
    const b0 = bytes[i]
    if (b0 <= 0x7f) {
      out += String.fromCharCode(b0)
      i++
      continue
    }
    if (b0 >= 0xc2 && b0 <= 0xdf) {
      if (i + 1 >= bytes.length || !isContinuation(bytes[i + 1])) {
        throw new Error(INVALID_PAIRING_URL_MESSAGE)
      }
      const codePoint = ((b0 & 0x1f) << 6) | (bytes[i + 1] & 0x3f)
      if (codePoint < 0x80) {
        throw new Error(INVALID_PAIRING_URL_MESSAGE)
      }
      out = appendCodePoint(out, codePoint)
      i += 2
      continue
    }
    if (b0 >= 0xe0 && b0 <= 0xef) {
      if (i + 2 >= bytes.length || !isContinuation(bytes[i + 1]) || !isContinuation(bytes[i + 2])) {
        throw new Error(INVALID_PAIRING_URL_MESSAGE)
      }
      const codePoint = ((b0 & 0x0f) << 12) | ((bytes[i + 1] & 0x3f) << 6) | (bytes[i + 2] & 0x3f)
      if (codePoint < 0x800 || (codePoint >= 0xd800 && codePoint <= 0xdfff)) {
        throw new Error(INVALID_PAIRING_URL_MESSAGE)
      }
      if (b0 === 0xe0 && bytes[i + 1] < 0xa0) {
        throw new Error(INVALID_PAIRING_URL_MESSAGE)
      }
      out = appendCodePoint(out, codePoint)
      i += 3
      continue
    }
    if (b0 >= 0xf0 && b0 <= 0xf4) {
      if (i + 3 >= bytes.length ||
        !isContinuation(bytes[i + 1]) ||
        !isContinuation(bytes[i + 2]) ||
        !isContinuation(bytes[i + 3])) {
        throw new Error(INVALID_PAIRING_URL_MESSAGE)
      }
      const codePoint = ((b0 & 0x07) << 18) |
        ((bytes[i + 1] & 0x3f) << 12) |
        ((bytes[i + 2] & 0x3f) << 6) |
        (bytes[i + 3] & 0x3f)
      if (codePoint < 0x10000 || codePoint > 0x10ffff) {
        throw new Error(INVALID_PAIRING_URL_MESSAGE)
      }
      if (b0 === 0xf0 && bytes[i + 1] < 0x90) {
        throw new Error(INVALID_PAIRING_URL_MESSAGE)
      }
      if (b0 === 0xf4 && bytes[i + 1] > 0x8f) {
        throw new Error(INVALID_PAIRING_URL_MESSAGE)
      }
      out = appendCodePoint(out, codePoint)
      i += 4
      continue
    }
    throw new Error(INVALID_PAIRING_URL_MESSAGE)
  }
  return out
}
