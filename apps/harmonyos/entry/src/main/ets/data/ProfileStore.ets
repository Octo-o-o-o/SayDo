import { preferences } from '@kit.ArkData'
import {
  DesktopProfile,
  DesktopProfileMetadata,
} from '../model/DesktopProfile'
import { getUIAbilityContext } from '../runtime/RuntimeRegistry'
import { HuksWrappedPreferenceStore } from '../security/SecureStore'

const PROFILE_PREFS_NAME: string = 'com.octoooo.saydo.desktopProfiles'
const PROFILES_KEY: string = 'profiles'
const CURRENT_ID_KEY: string = 'currentId'
const PENDING_TOKEN_DELETES_KEY: string = 'pendingTokenDeletes'
const TOKEN_KEY_PREFIX: string = 'desktopToken.'

export class ProfileSnapshot {
  profiles: Array<DesktopProfile>
  currentId: string

  constructor(profiles: Array<DesktopProfile>, currentId: string) {
    this.profiles = profiles
    this.currentId = currentId
  }
}

export class ProfileStore {
  private secureStore = new HuksWrappedPreferenceStore()

  private async openPrefs(): Promise<preferences.Preferences> {
    const context = getUIAbilityContext()
    if (context === null) {
      throw new Error('桌面列表尚未初始化')
    }
    return await preferences.getPreferences(context, PROFILE_PREFS_NAME)
  }

  async load(): Promise<ProfileSnapshot> {
    const prefs = await this.openPrefs()
    try {
      await this.cleanupPendingTokenDeletes(prefs)
    } catch (_e) {
      // Tombstone 保留，后续启动继续重试，不阻断仍有效的 profile。
    }
    const raw = await prefs.get(PROFILES_KEY, '[]') as string
    const storedCurrentId = await prefs.get(CURRENT_ID_KEY, '') as string
    let metadata: Array<DesktopProfileMetadata>
    try {
      const parsed = JSON.parse(raw) as Array<DesktopProfileMetadata>
      metadata = Array.isArray(parsed) ? parsed : []
    } catch (_e) {
      metadata = []
    }

    const profiles: Array<DesktopProfile> = []
    let tokenReadFailures = 0
    for (const item of metadata) {
      if (typeof item.id !== 'string' ||
          typeof item.name !== 'string' ||
          typeof item.url !== 'string' ||
          item.id.length === 0) {
        continue
      }
      try {
        const token = await this.secureStore.get(this.tokenKey(item.id))
        if (token !== null && token.length > 0) {
          profiles.push(new DesktopProfile(item.id, item.name, item.url, token))
        } else {
          tokenReadFailures++
        }
      } catch (_e) {
        tokenReadFailures++
      }
    }
    if (profiles.length === 0 && tokenReadFailures > 0) {
      throw new Error('无法读取本机桌面凭据')
    }

    let currentId = storedCurrentId
    if (!this.containsProfile(profiles, currentId)) {
      currentId = profiles.length > 0 ? profiles[0].id : ''
    }
    return new ProfileSnapshot(profiles, currentId)
  }

  async add(existing: Array<DesktopProfile>, profile: DesktopProfile): Promise<void> {
    await this.secureStore.set(this.tokenKey(profile.id), profile.token)
    const profiles = existing.slice()
    profiles.push(profile)
    try {
      await this.persist(profiles, profile.id)
    } catch (e) {
      await this.secureStore.wipe(this.tokenKey(profile.id))
      const error = e as Error
      throw new Error(error.message)
    }
  }

  async select(profiles: Array<DesktopProfile>, id: string): Promise<void> {
    if (!this.containsProfile(profiles, id)) {
      return
    }
    await this.persist(profiles, id)
  }

  async delete(profiles: Array<DesktopProfile>, id: string, currentId: string): Promise<string> {
    let removed: DesktopProfile | null = null
    const remaining: Array<DesktopProfile> = []
    for (const profile of profiles) {
      if (profile.id === id) {
        removed = profile
      } else {
        remaining.push(profile)
      }
    }
    if (removed === null) {
      return currentId
    }

    let nextCurrentId = currentId
    if (currentId === id) {
      nextCurrentId = remaining.length > 0 ? remaining[0].id : ''
    }
    await this.persistDeletion(remaining, nextCurrentId, id)
    try {
      await this.cleanupPendingTokenDeletes(await this.openPrefs())
    } catch (_e) {
      // profile 删除已经 durable；清凭据由 tombstone 在后续启动继续完成。
    }
    return nextCurrentId
  }

  private async persist(profiles: Array<DesktopProfile>, currentId: string): Promise<void> {
    const prefs = await this.openPrefs()
    await this.writeProfileState(prefs, profiles, currentId)
    await prefs.flush()
  }

  private async persistDeletion(
    profiles: Array<DesktopProfile>,
    currentId: string,
    deletedId: string,
  ): Promise<void> {
    const prefs = await this.openPrefs()
    const pendingDeletes = await this.readPendingTokenDeletes(prefs)
    if (pendingDeletes.indexOf(deletedId) < 0) {
      pendingDeletes.push(deletedId)
    }
    await this.writeProfileState(prefs, profiles, currentId)
    await prefs.put(PENDING_TOKEN_DELETES_KEY, JSON.stringify(pendingDeletes))
    await prefs.flush()
  }

  private async writeProfileState(
    prefs: preferences.Preferences,
    profiles: Array<DesktopProfile>,
    currentId: string,
  ): Promise<void> {
    const metadata: Array<DesktopProfileMetadata> = []
    for (const profile of profiles) {
      metadata.push(new DesktopProfileMetadata(profile.id, profile.name, profile.url))
    }
    await prefs.put(PROFILES_KEY, JSON.stringify(metadata))
    if (currentId.length > 0) {
      await prefs.put(CURRENT_ID_KEY, currentId)
    } else {
      await prefs.delete(CURRENT_ID_KEY)
    }
  }

  private async cleanupPendingTokenDeletes(prefs: preferences.Preferences): Promise<void> {
    const pendingDeletes = await this.readPendingTokenDeletes(prefs)
    if (pendingDeletes.length === 0) {
      return
    }
    const remaining: Array<string> = []
    for (const id of pendingDeletes) {
      try {
        await this.secureStore.wipe(this.tokenKey(id))
      } catch (_e) {
        remaining.push(id)
      }
    }
    if (remaining.length > 0) {
      await prefs.put(PENDING_TOKEN_DELETES_KEY, JSON.stringify(remaining))
    } else {
      await prefs.delete(PENDING_TOKEN_DELETES_KEY)
    }
    await prefs.flush()
  }

  private async readPendingTokenDeletes(prefs: preferences.Preferences): Promise<Array<string>> {
    const raw = await prefs.get(PENDING_TOKEN_DELETES_KEY, '[]') as string
    try {
      const parsed = JSON.parse(raw) as Array<string>
      if (!Array.isArray(parsed)) {
        return []
      }
      const ids: Array<string> = []
      for (const id of parsed) {
        if (typeof id === 'string' && id.length > 0 && ids.indexOf(id) < 0) {
          ids.push(id)
        }
      }
      return ids
    } catch (_e) {
      return []
    }
  }

  private containsProfile(profiles: Array<DesktopProfile>, id: string): boolean {
    for (const profile of profiles) {
      if (profile.id === id) {
        return true
      }
    }
    return false
  }

  private tokenKey(id: string): string {
    return TOKEN_KEY_PREFIX + id
  }
}
