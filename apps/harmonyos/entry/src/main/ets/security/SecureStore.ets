import { preferences } from '@kit.ArkData'
import { huks } from '@kit.UniversalKeystoreKit'
import { cryptoFramework } from '@kit.CryptoArchitectureKit'
import { BusinessError } from '@kit.BasicServicesKit'
import { util } from '@kit.ArkTS'
import { getUIAbilityContext } from '../runtime/RuntimeRegistry'

const SECURE_PREFS_NAME: string = 'com.octoooo.saydo.desktopTokens'
const HUKS_ALIAS: string = 'saydo.desktopTokens.wrapKey'
const GCM_ENVELOPE: string = 'gcm2'
const GCM_TAG_BYTES: number = 16

export class HuksWrappedPreferenceStore {
  private async openPrefs(): Promise<preferences.Preferences> {
    const context = getUIAbilityContext()
    if (context === null) {
      throw new Error('安全存储尚未初始化')
    }
    return await preferences.getPreferences(context, SECURE_PREFS_NAME)
  }

  async get(key: string): Promise<string | null> {
    const prefs = await this.openPrefs()
    const wrapped = await prefs.get(key, '') as string
    if (wrapped.length === 0) {
      return null
    }
    return await this.unwrap(wrapped)
  }

  async set(key: string, value: string): Promise<void> {
    await this.ensureKey()
    const wrapped = await this.wrap(value)
    const prefs = await this.openPrefs()
    await prefs.put(key, wrapped)
    await prefs.flush()
  }

  async wipe(key: string): Promise<void> {
    const prefs = await this.openPrefs()
    await prefs.delete(key)
    await prefs.flush()
  }

  private async ensureKey(): Promise<void> {
    try {
      if (await huks.isKeyItemExist(HUKS_ALIAS, { properties: [] })) {
        return
      }
    } catch (_e) {
      // 不存在或暂不可读时继续生成。
    }

    const options: huks.HuksOptions = {
      properties: [
        { tag: huks.HuksTag.HUKS_TAG_ALGORITHM, value: huks.HuksKeyAlg.HUKS_ALG_AES },
        { tag: huks.HuksTag.HUKS_TAG_KEY_SIZE, value: huks.HuksKeySize.HUKS_AES_KEY_SIZE_256 },
        {
          tag: huks.HuksTag.HUKS_TAG_PURPOSE,
          value: huks.HuksKeyPurpose.HUKS_KEY_PURPOSE_ENCRYPT |
            huks.HuksKeyPurpose.HUKS_KEY_PURPOSE_DECRYPT,
        },
        { tag: huks.HuksTag.HUKS_TAG_PADDING, value: huks.HuksKeyPadding.HUKS_PADDING_NONE },
        { tag: huks.HuksTag.HUKS_TAG_BLOCK_MODE, value: huks.HuksCipherMode.HUKS_MODE_GCM },
      ],
    }
    try {
      await huks.generateKeyItem(HUKS_ALIAS, options)
    } catch (e) {
      const error = e as BusinessError
      throw new Error('无法创建本机安全密钥（' + error.code + '）')
    }
  }

  private async wrap(value: string): Promise<string> {
    const nonce = new Uint8Array(cryptoFramework.createRandom().generateRandomSync(12).data)
    const plaintext = new util.TextEncoder().encodeInto(value)
    const options: huks.HuksOptions = {
      properties: [
        { tag: huks.HuksTag.HUKS_TAG_ALGORITHM, value: huks.HuksKeyAlg.HUKS_ALG_AES },
        { tag: huks.HuksTag.HUKS_TAG_KEY_SIZE, value: huks.HuksKeySize.HUKS_AES_KEY_SIZE_256 },
        { tag: huks.HuksTag.HUKS_TAG_PURPOSE, value: huks.HuksKeyPurpose.HUKS_KEY_PURPOSE_ENCRYPT },
        { tag: huks.HuksTag.HUKS_TAG_PADDING, value: huks.HuksKeyPadding.HUKS_PADDING_NONE },
        { tag: huks.HuksTag.HUKS_TAG_BLOCK_MODE, value: huks.HuksCipherMode.HUKS_MODE_GCM },
        { tag: huks.HuksTag.HUKS_TAG_NONCE, value: nonce },
      ],
      inData: plaintext,
    }

    try {
      const handle = await huks.initSession(HUKS_ALIAS, options)
      const result = await huks.finishSession(handle.handle, options)
      if (!result.outData) {
        throw new Error('HUKS 未返回密文')
      }
      let ciphertext = result.outData
      let tag = findBytesParam(result.properties, huks.HuksTag.HUKS_TAG_AE_TAG)
      if (tag === null && result.outData.length > GCM_TAG_BYTES) {
        const offset = result.outData.length - GCM_TAG_BYTES
        ciphertext = result.outData.slice(0, offset)
        tag = result.outData.slice(offset)
      }
      if (tag === null) {
        throw new Error('HUKS 未返回认证标签')
      }
      return GCM_ENVELOPE + '|' + bytesToHex(nonce) + '|' + bytesToHex(tag) + '|' +
        bytesToHex(ciphertext)
    } catch (e) {
      const error = e as BusinessError
      const detail = typeof error.message === 'string' && error.message.length > 0
        ? error.message
        : String(error.code)
      throw new Error('无法安全保存桌面凭据（' + detail + '）')
    }
  }

  private async unwrap(envelope: string): Promise<string> {
    const parts = envelope.split('|')
    if (parts.length !== 4 || parts[0] !== GCM_ENVELOPE) {
      throw new Error('本机桌面凭据格式已损坏')
    }
    const nonce = hexToBytes(parts[1])
    const tag = hexToBytes(parts[2])
    const ciphertext = hexToBytes(parts[3])
    const options: huks.HuksOptions = {
      properties: [
        { tag: huks.HuksTag.HUKS_TAG_ALGORITHM, value: huks.HuksKeyAlg.HUKS_ALG_AES },
        { tag: huks.HuksTag.HUKS_TAG_KEY_SIZE, value: huks.HuksKeySize.HUKS_AES_KEY_SIZE_256 },
        { tag: huks.HuksTag.HUKS_TAG_PURPOSE, value: huks.HuksKeyPurpose.HUKS_KEY_PURPOSE_DECRYPT },
        { tag: huks.HuksTag.HUKS_TAG_PADDING, value: huks.HuksKeyPadding.HUKS_PADDING_NONE },
        { tag: huks.HuksTag.HUKS_TAG_BLOCK_MODE, value: huks.HuksCipherMode.HUKS_MODE_GCM },
        { tag: huks.HuksTag.HUKS_TAG_NONCE, value: nonce },
        { tag: huks.HuksTag.HUKS_TAG_AE_TAG, value: tag },
      ],
      inData: ciphertext,
    }

    try {
      const handle = await huks.initSession(HUKS_ALIAS, options)
      const result = await huks.finishSession(handle.handle, options)
      if (!result.outData) {
        throw new Error('HUKS 未返回明文')
      }
      return util.TextDecoder.create('utf-8').decodeToString(result.outData)
    } catch (e) {
      const error = e as BusinessError
      const detail = typeof error.message === 'string' && error.message.length > 0
        ? error.message
        : String(error.code)
      throw new Error('无法读取本机桌面凭据（' + detail + '）')
    }
  }
}

const HEX: string = '0123456789abcdef'

function bytesToHex(bytes: Uint8Array): string {
  let output = ''
  for (let i = 0; i < bytes.length; i++) {
    const value = bytes[i]
    output += HEX.charAt((value >> 4) & 0xf)
    output += HEX.charAt(value & 0xf)
  }
  return output
}

function hexToBytes(value: string): Uint8Array {
  if (value.length % 2 !== 0) {
    throw new Error('密文不是完整字节')
  }
  const output = new Uint8Array(value.length / 2)
  for (let i = 0; i < output.length; i++) {
    const high = HEX.indexOf(value.charAt(i * 2))
    const low = HEX.indexOf(value.charAt(i * 2 + 1))
    if (high < 0 || low < 0) {
      throw new Error('密文包含非十六进制字符')
    }
    output[i] = ((high << 4) | low) & 0xff
  }
  return output
}

function findBytesParam(
  properties: Array<huks.HuksParam> | undefined,
  tag: huks.HuksTag,
): Uint8Array | null {
  if (!properties) {
    return null
  }
  for (const parameter of properties) {
    if (parameter.tag === tag && parameter.value instanceof Uint8Array) {
      return parameter.value
    }
  }
  return null
}
