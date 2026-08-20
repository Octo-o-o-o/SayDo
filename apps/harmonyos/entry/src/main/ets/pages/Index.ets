import { common } from '@kit.AbilityKit'
import { webview } from '@kit.ArkWeb'
import { ProfileSnapshot, ProfileStore } from '../data/ProfileStore'
import { DesktopProfile, INVALID_PAIRING_URL_MESSAGE } from '../model/DesktopProfile'
import { setUIAbilityContext } from '../runtime/RuntimeRegistry'
import { ScanOutcome, ScanPlugin } from '../scan/ScanPlugin'

@Entry
@Component
struct Index {
  @State private profiles: Array<DesktopProfile> = []
  @State private currentId: string = ''
  @State private screen: string = 'home'
  @State private loading: boolean = true
  @State private busy: boolean = false
  @State private message: string = ''
  @State private webFailure: boolean = false
  @State private pendingId: string = ''
  @State private pendingName: string = ''
  @State private pendingUrl: string = ''
  @State private pendingToken: string = ''

  private profileStore = new ProfileStore()
  private scanPlugin: ScanPlugin | null = null
  private webController: webview.WebviewController = new webview.WebviewController()

  aboutToAppear(): void {
    const context = getContext(this) as common.UIAbilityContext
    setUIAbilityContext(context)
    this.scanPlugin = new ScanPlugin(context)
    void this.loadProfiles()
  }

  build(): void {
    Stack() {
      if (this.screen === 'profiles') {
        this.profileListPage()
      } else if (this.screen === 'confirm') {
        this.confirmPage()
      } else {
        this.homePage()
      }
    }
    .width('100%')
    .height('100%')
    .backgroundColor('#FFF7F8FA')
  }

  @Builder
  private homePage(): void {
    if (this.loading) {
      Column({ space: 12 }) {
        Text('正在读取桌面连接')
          .fontSize(16)
          .fontColor('#FF5B6472')
      }
      .justifyContent(FlexAlign.Center)
      .width('100%')
      .height('100%')
    } else if (this.currentProfile() === null) {
      Column({ space: 18 }) {
        Text('SayDo')
          .fontSize(34)
          .fontWeight(FontWeight.Bold)
          .fontColor('#FF17202A')
        Text('扫桌面上的二维码连接')
          .fontSize(17)
          .fontColor('#FF5B6472')
        Text('手机和桌面需要在同一可达网络')
          .fontSize(14)
          .fontColor('#FF7A8492')
        Button('扫码连接')
          .type(ButtonType.Capsule)
          .fontSize(17)
          .backgroundColor('#FF276EF1')
          .onClick(() => {
            void this.beginScan()
          })
        if (this.message.length > 0) {
          Text(this.message)
            .fontSize(14)
            .fontColor('#FFB3261E')
            .textAlign(TextAlign.Center)
            .padding({ left: 28, right: 28 })
        }
      }
      .justifyContent(FlexAlign.Center)
      .width('100%')
      .height('100%')
      .padding(24)
    } else {
      Column() {
        Row({ space: 12 }) {
          Text(this.currentProfileName())
            .fontSize(16)
            .fontWeight(FontWeight.Medium)
            .fontColor('#FF17202A')
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
            .layoutWeight(1)
          Text('切换')
            .fontSize(14)
            .fontColor('#FF276EF1')
        }
        .height(48)
        .width('100%')
        .padding({ left: 18, right: 18 })
        .backgroundColor('#FFFFFFFF')
        .border({ width: { bottom: 1 }, color: '#FFE3E6EA' })
        .onClick(() => {
          this.message = ''
          this.screen = 'profiles'
        })

        if (this.webFailure) {
          Column({ space: 14 }) {
            Text('连不上桌面')
              .fontSize(21)
              .fontWeight(FontWeight.Medium)
              .fontColor('#FF17202A')
            Text('确认手机和桌面在同一 Wi-Fi，或重新扫码配对')
              .fontSize(15)
              .fontColor('#FF5B6472')
              .textAlign(TextAlign.Center)
            Button('重试')
              .type(ButtonType.Capsule)
              .backgroundColor('#FF276EF1')
              .onClick(() => {
                this.webFailure = false
              })
          }
          .justifyContent(FlexAlign.Center)
          .width('100%')
          .layoutWeight(1)
          .padding(28)
        } else {
          Web({ src: this.currentAuthenticatedUrl(), controller: this.webController })
            .javaScriptAccess(true)
            .domStorageAccess(true)
            .fileAccess(false)
            .imageAccess(true)
            .onlineImageAccess(true)
            .mixedMode(MixedMode.All)
            .onPageBegin(() => {
              this.webFailure = false
            })
            .onErrorReceive((event) => {
              if (event.request.isMainFrame()) {
                this.webFailure = true
              }
            })
            .onHttpErrorReceive((event) => {
              if (event.request.isMainFrame() && event.response.getResponseCode() >= 400) {
                this.webFailure = true
              }
            })
            .width('100%')
            .layoutWeight(1)
        }
      }
      .width('100%')
      .height('100%')
    }
  }

  @Builder
  private profileListPage(): void {
    Column() {
      Row() {
        Button('关闭')
          .type(ButtonType.Normal)
          .backgroundColor(Color.Transparent)
          .fontColor('#FF276EF1')
          .onClick(() => {
            this.screen = 'home'
          })
        Text('桌面')
          .fontSize(20)
          .fontWeight(FontWeight.Bold)
          .fontColor('#FF17202A')
          .layoutWeight(1)
          .textAlign(TextAlign.Center)
        Button('添加')
          .type(ButtonType.Normal)
          .backgroundColor(Color.Transparent)
          .fontColor('#FF276EF1')
          .onClick(() => {
            void this.beginScan()
          })
      }
      .height(56)
      .width('100%')
      .padding({ left: 8, right: 8 })
      .backgroundColor('#FFFFFFFF')

      Scroll() {
        Column({ space: 10 }) {
          ForEach(this.profiles, (profile: DesktopProfile) => {
            Row({ space: 12 }) {
              Column({ space: 4 }) {
                Text(profile.name)
                  .fontSize(17)
                  .fontWeight(profile.id === this.currentId ? FontWeight.Medium : FontWeight.Regular)
                  .fontColor('#FF17202A')
                  .maxLines(1)
                  .textOverflow({ overflow: TextOverflow.Ellipsis })
                  .width('100%')
                Text(profile.address())
                  .fontSize(13)
                  .fontColor('#FF7A8492')
                  .width('100%')
              }
              .alignItems(HorizontalAlign.Start)
              .layoutWeight(1)
              .onClick(() => {
                void this.selectProfile(profile.id)
              })
              Button('删除')
                .type(ButtonType.Normal)
                .backgroundColor('#FFFDEBEC')
                .fontColor('#FFB3261E')
                .onClick(() => {
                  void this.deleteProfile(profile.id)
                })
            }
            .width('100%')
            .padding(16)
            .backgroundColor('#FFFFFFFF')
            .borderRadius(14)
          }, (profile: DesktopProfile): string => profile.id)

          if (this.message.length > 0) {
            Text(this.message)
              .fontSize(14)
              .fontColor('#FFB3261E')
              .textAlign(TextAlign.Center)
              .padding(12)
          }
        }
        .width('100%')
        .padding(16)
      }
      .layoutWeight(1)
      .width('100%')
    }
    .width('100%')
    .height('100%')
  }

  @Builder
  private confirmPage(): void {
    Column() {
      Row() {
        Button('取消')
          .type(ButtonType.Normal)
          .backgroundColor(Color.Transparent)
          .fontColor('#FF276EF1')
          .onClick(() => {
            this.cancelConfirmation()
          })
        Text('确认桌面')
          .fontSize(20)
          .fontWeight(FontWeight.Bold)
          .fontColor('#FF17202A')
          .layoutWeight(1)
          .textAlign(TextAlign.Center)
        Blank().width(64)
      }
      .height(56)
      .width('100%')
      .padding({ left: 8, right: 8 })
      .backgroundColor('#FFFFFFFF')

      Column({ space: 18 }) {
        Text('桌面名称')
          .fontSize(14)
          .fontColor('#FF5B6472')
          .width('100%')
        TextInput({ text: this.pendingName, placeholder: '例如：书房电脑' })
          .onChange((value: string) => {
            this.pendingName = value
          })
          .height(48)
          .backgroundColor('#FFFFFFFF')
        Text('地址')
          .fontSize(14)
          .fontColor('#FF5B6472')
          .width('100%')
        Text(this.pendingAddress())
          .fontSize(16)
          .fontColor('#FF17202A')
          .width('100%')
          .padding(14)
          .backgroundColor('#FFFFFFFF')
          .borderRadius(10)
        if (this.message.length > 0) {
          Text(this.message)
            .fontSize(14)
            .fontColor('#FFB3261E')
            .width('100%')
        }
        Button(this.busy ? '正在保存' : '保存并连接')
          .type(ButtonType.Capsule)
          .enabled(!this.busy && this.pendingName.trim().length > 0)
          .width('100%')
          .backgroundColor('#FF276EF1')
          .onClick(() => {
            void this.savePendingProfile()
          })
        Button('重新扫描')
          .type(ButtonType.Capsule)
          .enabled(!this.busy)
          .width('100%')
          .backgroundColor('#FFE8EEF9')
          .fontColor('#FF276EF1')
          .onClick(() => {
            void this.beginScan()
          })
      }
      .alignItems(HorizontalAlign.Start)
      .padding(24)
      .width('100%')
    }
    .width('100%')
    .height('100%')
  }

  private async loadProfiles(): Promise<void> {
    try {
      const snapshot: ProfileSnapshot = await this.profileStore.load()
      this.profiles = snapshot.profiles
      this.currentId = snapshot.currentId
      this.message = ''
    } catch (_e) {
      this.profiles = []
      this.currentId = ''
      this.message = '无法读取本机桌面连接，请重启后再试'
    } finally {
      this.loading = false
    }
  }

  private async beginScan(): Promise<void> {
    if (this.busy || this.scanPlugin === null) {
      return
    }
    this.busy = true
    this.message = ''
    try {
      const outcome: ScanOutcome = await this.scanPlugin.scan()
      if (outcome.status === 'cancelled') {
        return
      }
      if (outcome.status === 'permission_denied') {
        this.message = '请在系统设置中允许 SayDo 使用相机'
        return
      }
      if (outcome.status !== 'ok') {
        this.message = '当前设备无法使用系统扫码，请确认已安装 HMS Core'
        return
      }
      const profile = DesktopProfile.fromPairingUrl(outcome.value)
      this.pendingId = profile.id
      this.pendingName = profile.name
      this.pendingUrl = profile.url
      this.pendingToken = profile.token
      this.screen = 'confirm'
    } catch (_e) {
      this.message = INVALID_PAIRING_URL_MESSAGE
    } finally {
      this.busy = false
    }
  }

  private async savePendingProfile(): Promise<void> {
    const name = this.pendingName.trim()
    if (this.busy || name.length === 0 || this.pendingToken.length === 0) {
      return
    }
    this.busy = true
    this.message = ''
    const profile = new DesktopProfile(
      this.pendingId,
      name,
      this.pendingUrl,
      this.pendingToken,
    )
    try {
      await this.profileStore.add(this.profiles, profile)
      const updated = this.profiles.slice()
      updated.push(profile)
      this.profiles = updated
      this.currentId = profile.id
      this.clearPendingProfile()
      this.webFailure = false
      this.screen = 'home'
    } catch (_e) {
      this.message = '无法安全保存桌面凭据，请稍后再试'
    } finally {
      this.busy = false
    }
  }

  private async selectProfile(id: string): Promise<void> {
    if (this.busy) {
      return
    }
    this.busy = true
    this.message = ''
    try {
      await this.profileStore.select(this.profiles, id)
      this.currentId = id
      this.webFailure = false
      this.screen = 'home'
    } catch (_e) {
      this.message = '无法切换桌面，请稍后再试'
    } finally {
      this.busy = false
    }
  }

  private async deleteProfile(id: string): Promise<void> {
    if (this.busy) {
      return
    }
    this.busy = true
    this.message = ''
    try {
      const nextCurrentId = await this.profileStore.delete(this.profiles, id, this.currentId)
      const remaining: Array<DesktopProfile> = []
      for (const profile of this.profiles) {
        if (profile.id !== id) {
          remaining.push(profile)
        }
      }
      this.profiles = remaining
      this.currentId = nextCurrentId
      this.webFailure = false
      if (remaining.length === 0) {
        this.screen = 'home'
      }
    } catch (_e) {
      this.message = '无法删除桌面，请稍后再试'
    } finally {
      this.busy = false
    }
  }

  private currentProfile(): DesktopProfile | null {
    for (const profile of this.profiles) {
      if (profile.id === this.currentId) {
        return profile
      }
    }
    return null
  }

  private currentProfileName(): string {
    const profile = this.currentProfile()
    return profile === null ? '' : profile.name
  }

  private currentAuthenticatedUrl(): string {
    const profile = this.currentProfile()
    return profile === null ? 'about:blank' : profile.authenticatedUrl()
  }

  private pendingAddress(): string {
    if (this.pendingUrl.length === 0) {
      return ''
    }
    return new DesktopProfile('', '', this.pendingUrl, '').address()
  }

  private cancelConfirmation(): void {
    this.clearPendingProfile()
    this.message = ''
    this.screen = this.profiles.length > 0 ? 'profiles' : 'home'
  }

  private clearPendingProfile(): void {
    this.pendingId = ''
    this.pendingName = ''
    this.pendingUrl = ''
    this.pendingToken = ''
  }
}
