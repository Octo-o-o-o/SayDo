import { common } from '@kit.AbilityKit'

export class ScanOutcome {
  status: string
  value: string

  constructor(status: string, value: string = '') {
    this.status = status
    this.value = value
  }
}

interface ScanKitTypeApi {
  QR_CODE: number
}

interface ScanKitCoreApi {
  ScanType: ScanKitTypeApi
}

interface ScanKitOptions {
  scanTypes: Array<number>
  enableMultiMode: boolean
  enableAlbum: boolean
}

interface ScanKitResult {
  originalValue?: string
}

interface ScanKitBarcodeApi {
  startScanForResult(
    context: common.UIAbilityContext,
    options: ScanKitOptions,
  ): Promise<ScanKitResult>
}

/**
 * `@kit.ScanKit` 是两个 HMS 模块的 facade。这里按 OctoDesk 已验证的做法延迟加载底层模块，
 * 避免非 HMS 设备在页面初始化阶段因静态 import 直接崩溃。
 */
export class ScanPlugin {
  private context: common.UIAbilityContext
  private inflight: Promise<ScanOutcome> | null = null

  constructor(context: common.UIAbilityContext) {
    this.context = context
  }

  async scan(): Promise<ScanOutcome> {
    if (this.inflight !== null) {
      return this.inflight
    }
    const promise = this.runScan()
    this.inflight = promise
    try {
      return await promise
    } finally {
      this.inflight = null
    }
  }

  private async runScan(): Promise<ScanOutcome> {
    let scanBarcodeModule: ESObject
    let scanCoreModule: ESObject
    try {
      scanBarcodeModule = await import('@hms.core.scan.scanBarcode')
      scanCoreModule = await import('@hms.core.scan.scanCore')
    } catch (_e) {
      return new ScanOutcome('unavailable')
    }

    try {
      const scanBarcode = scanBarcodeModule.default as ScanKitBarcodeApi
      const scanCore = scanCoreModule.default as ScanKitCoreApi
      const options: ScanKitOptions = {
        scanTypes: [scanCore.ScanType.QR_CODE],
        enableMultiMode: false,
        enableAlbum: true,
      }
      const result = await scanBarcode.startScanForResult(this.context, options)
      const value = result.originalValue ? result.originalValue.trim() : ''
      return value.length > 0
        ? new ScanOutcome('ok', value)
        : new ScanOutcome('cancelled')
    } catch (e) {
      const error: ESObject = e
      const code = typeof error.code === 'number' ? error.code as number : -1
      if (code === 1000500001 || code === 1000500002) {
        return new ScanOutcome('cancelled')
      }
      if (code === 1000500003) {
        return new ScanOutcome('permission_denied')
      }
      return new ScanOutcome('unavailable')
    }
  }
}
