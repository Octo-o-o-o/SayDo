import { common } from '@kit.AbilityKit'

let uiAbilityContext: common.UIAbilityContext | null = null

export function setUIAbilityContext(context: common.UIAbilityContext): void {
  uiAbilityContext = context
}
export function getUIAbilityContext(): common.UIAbilityContext | null {
  return uiAbilityContext
}
