import { cryptoFramework } from '@kit.CryptoArchitectureKit'
import {
  INVALID_PAIRING_URL_MESSAGE,
  authenticatedPairingUrl,
  lanAddressFromHttpUrl,
  parsePairingUrl,
} from './pairingUrl'

export { INVALID_PAIRING_URL_MESSAGE }

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
    return authenticatedPairingUrl(this.url, this.token)
  }

  address(): string {
    return lanAddressFromHttpUrl(this.url)
  }

  static fromPairingUrl(value: string): DesktopProfile {
    const parsed = parsePairingUrl(value)
    return new DesktopProfile(
      generateProfileId(),
      parsed.name,
      parsed.baseUrl,
      parsed.token,
    )
  }
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
