// Generated from scripts/pairing-url-corpus.json. Do not edit.

export class PairingCorpusCase {
  id: string = ''
  accept: boolean = false
  prefix: string = ''
  hostParts: Array<string> = []
  hostSep: string = ''
  bracketHost: boolean = false
  port: string = ''
  pathQuery: string = ''
  suffix: string = ''
  token: string = ''
  expectPort: string = ''
}

function joinParts(parts: Array<string>, sep: string): string {
  let out = ''
  for (let i = 0; i < parts.length; i++) {
    if (i > 0) {
      out += sep
    }
    out += parts[i]
  }
  return out
}

export function pairingCorpusInput(item: PairingCorpusCase): string {
  const host = joinParts(item.hostParts, item.hostSep)
  const authority = item.bracketHost ? ('[' + host + ']') : host
  return item.prefix + authority + ':' + item.port + item.pathQuery + item.suffix
}

export function pairingCorpusExpectedName(item: PairingCorpusCase): string {
  if (item.expectPort.length === 0) {
    return ''
  }
  return joinParts(item.hostParts, item.hostSep) + ':' + String(Number(item.expectPort))
}

export function pairingCorpusCases(): Array<PairingCorpusCase> {
  const cases: Array<PairingCorpusCase> = []
  const c0 = new PairingCorpusCase()
  c0.id = 'accept-ipv4'
  c0.accept = true
  c0.prefix = 'http://'
  c0.hostParts = ['192', '168', '1', '8']
  c0.hostSep = '.'
  c0.bracketHost = false
  c0.port = '47100'
  c0.pathQuery = '/?token=abc'
  c0.suffix = ''
  c0.token = 'abc'
  c0.expectPort = '47100'
  cases.push(c0)
  const c1 = new PairingCorpusCase()
  c1.id = 'accept-ascii-trim'
  c1.accept = true
  c1.prefix = '\n\t http://'
  c1.hostParts = ['192', '168', '1', '8']
  c1.hostSep = '.'
  c1.bracketHost = false
  c1.port = '47100'
  c1.pathQuery = '/?token=abc'
  c1.suffix = ' \r\n'
  c1.token = 'abc'
  c1.expectPort = '47100'
  cases.push(c1)
  const c2 = new PairingCorpusCase()
  c2.id = 'accept-trim-cr'
  c2.accept = true
  c2.prefix = '\rhttp://'
  c2.hostParts = ['192', '168', '1', '8']
  c2.hostSep = '.'
  c2.bracketHost = false
  c2.port = '47100'
  c2.pathQuery = '/?token=abc'
  c2.suffix = '\r'
  c2.token = 'abc'
  c2.expectPort = '47100'
  cases.push(c2)
  const c3 = new PairingCorpusCase()
  c3.id = 'accept-trim-lf'
  c3.accept = true
  c3.prefix = '\nhttp://'
  c3.hostParts = ['192', '168', '1', '8']
  c3.hostSep = '.'
  c3.bracketHost = false
  c3.port = '47100'
  c3.pathQuery = '/?token=abc'
  c3.suffix = '\n'
  c3.token = 'abc'
  c3.expectPort = '47100'
  cases.push(c3)
  const c4 = new PairingCorpusCase()
  c4.id = 'accept-trim-crlf'
  c4.accept = true
  c4.prefix = '\r\nhttp://'
  c4.hostParts = ['192', '168', '1', '8']
  c4.hostSep = '.'
  c4.bracketHost = false
  c4.port = '47100'
  c4.pathQuery = '/?token=abc'
  c4.suffix = '\r\n'
  c4.token = 'abc'
  c4.expectPort = '47100'
  cases.push(c4)
  const c5 = new PairingCorpusCase()
  c5.id = 'accept-trim-mixed'
  c5.accept = true
  c5.prefix = '\r\n\t http://'
  c5.hostParts = ['192', '168', '1', '8']
  c5.hostSep = '.'
  c5.bracketHost = false
  c5.port = '47100'
  c5.pathQuery = '/?token=abc'
  c5.suffix = ' \t\r\n'
  c5.token = 'abc'
  c5.expectPort = '47100'
  cases.push(c5)
  const c6 = new PairingCorpusCase()
  c6.id = 'accept-leading-zero-port'
  c6.accept = true
  c6.prefix = 'http://'
  c6.hostParts = ['192', '168', '1', '8']
  c6.hostSep = '.'
  c6.bracketHost = false
  c6.port = '047100'
  c6.pathQuery = '/?token=abc'
  c6.suffix = ''
  c6.token = 'abc'
  c6.expectPort = '47100'
  cases.push(c6)
  const c7 = new PairingCorpusCase()
  c7.id = 'accept-ula'
  c7.accept = true
  c7.prefix = 'http://'
  c7.hostParts = ['fd12', '3456', '789a', '1', '', '1']
  c7.hostSep = ':'
  c7.bracketHost = true
  c7.port = '47100'
  c7.pathQuery = '/?token=abc'
  c7.suffix = ''
  c7.token = 'abc'
  c7.expectPort = '47100'
  cases.push(c7)
  const c8 = new PairingCorpusCase()
  c8.id = 'accept-percent-reserved'
  c8.accept = true
  c8.prefix = 'http://'
  c8.hostParts = ['192', '168', '1', '8']
  c8.hostSep = '.'
  c8.bracketHost = false
  c8.port = '47100'
  c8.pathQuery = '/?token=a%2Fb%20c%2Bd'
  c8.suffix = ''
  c8.token = 'a/b c+d'
  c8.expectPort = '47100'
  cases.push(c8)
  const c9 = new PairingCorpusCase()
  c9.id = 'accept-percent-bmp'
  c9.accept = true
  c9.prefix = 'http://'
  c9.hostParts = ['192', '168', '1', '8']
  c9.hostSep = '.'
  c9.bracketHost = false
  c9.port = '47100'
  c9.pathQuery = '/?token=%E4%BD%A0%E5%A5%BD'
  c9.suffix = ''
  c9.token = '\u4F60\u597D'
  c9.expectPort = '47100'
  cases.push(c9)
  const c10 = new PairingCorpusCase()
  c10.id = 'accept-percent-non-bmp'
  c10.accept = true
  c10.prefix = 'http://'
  c10.hostParts = ['192', '168', '1', '8']
  c10.hostSep = '.'
  c10.bracketHost = false
  c10.port = '47100'
  c10.pathQuery = '/?token=%F0%90%80%80'
  c10.suffix = ''
  c10.token = '' + String.fromCharCode(55296) + String.fromCharCode(56320) + ''
  c10.expectPort = '47100'
  cases.push(c10)
  const c11 = new PairingCorpusCase()
  c11.id = 'reject-bom'
  c11.accept = false
  c11.prefix = '\uFEFFhttp://'
  c11.hostParts = ['192', '168', '1', '8']
  c11.hostSep = '.'
  c11.bracketHost = false
  c11.port = '47100'
  c11.pathQuery = '/?token=abc'
  c11.suffix = ''
  c11.token = ''
  c11.expectPort = ''
  cases.push(c11)
  const c12 = new PairingCorpusCase()
  c12.id = 'reject-nbsp'
  c12.accept = false
  c12.prefix = '\u00A0http://'
  c12.hostParts = ['192', '168', '1', '8']
  c12.hostSep = '.'
  c12.bracketHost = false
  c12.port = '47100'
  c12.pathQuery = '/?token=abc'
  c12.suffix = ''
  c12.token = ''
  c12.expectPort = ''
  cases.push(c12)
  const c13 = new PairingCorpusCase()
  c13.id = 'reject-raw-space'
  c13.accept = false
  c13.prefix = 'http://'
  c13.hostParts = ['192', '168', '1', '8']
  c13.hostSep = '.'
  c13.bracketHost = false
  c13.port = '47100'
  c13.pathQuery = '/?token=abc def'
  c13.suffix = ''
  c13.token = ''
  c13.expectPort = ''
  cases.push(c13)
  const c14 = new PairingCorpusCase()
  c14.id = 'reject-raw-tab'
  c14.accept = false
  c14.prefix = 'http://'
  c14.hostParts = ['192', '168', '1', '8']
  c14.hostSep = '.'
  c14.bracketHost = false
  c14.port = '47100'
  c14.pathQuery = '/?token=abc\tdef'
  c14.suffix = ''
  c14.token = ''
  c14.expectPort = ''
  cases.push(c14)
  const c15 = new PairingCorpusCase()
  c15.id = 'reject-raw-nul'
  c15.accept = false
  c15.prefix = 'http://'
  c15.hostParts = ['192', '168', '1', '8']
  c15.hostSep = '.'
  c15.bracketHost = false
  c15.port = '47100'
  c15.pathQuery = '/?token=abc\0'
  c15.suffix = ''
  c15.token = ''
  c15.expectPort = ''
  cases.push(c15)
  const c16 = new PairingCorpusCase()
  c16.id = 'reject-raw-at'
  c16.accept = false
  c16.prefix = 'http://'
  c16.hostParts = ['192', '168', '1', '8']
  c16.hostSep = '.'
  c16.bracketHost = false
  c16.port = '47100'
  c16.pathQuery = '/?token=abc@x'
  c16.suffix = ''
  c16.token = ''
  c16.expectPort = ''
  cases.push(c16)
  const c17 = new PairingCorpusCase()
  c17.id = 'reject-raw-brackets'
  c17.accept = false
  c17.prefix = 'http://'
  c17.hostParts = ['192', '168', '1', '8']
  c17.hostSep = '.'
  c17.bracketHost = false
  c17.port = '47100'
  c17.pathQuery = '/?token=abc[x]'
  c17.suffix = ''
  c17.token = ''
  c17.expectPort = ''
  cases.push(c17)
  const c18 = new PairingCorpusCase()
  c18.id = 'reject-raw-non-bmp'
  c18.accept = false
  c18.prefix = 'http://'
  c18.hostParts = ['192', '168', '1', '8']
  c18.hostSep = '.'
  c18.bracketHost = false
  c18.port = '47100'
  c18.pathQuery = '/?token=abc' + String.fromCharCode(55296) + String.fromCharCode(56320) + ''
  c18.suffix = ''
  c18.token = ''
  c18.expectPort = ''
  cases.push(c18)
  const c19 = new PairingCorpusCase()
  c19.id = 'reject-bad-percent-zz'
  c19.accept = false
  c19.prefix = 'http://'
  c19.hostParts = ['192', '168', '1', '8']
  c19.hostSep = '.'
  c19.bracketHost = false
  c19.port = '47100'
  c19.pathQuery = '/?token=%zz'
  c19.suffix = ''
  c19.token = ''
  c19.expectPort = ''
  cases.push(c19)
  const c20 = new PairingCorpusCase()
  c20.id = 'reject-truncated-percent'
  c20.accept = false
  c20.prefix = 'http://'
  c20.hostParts = ['192', '168', '1', '8']
  c20.hostSep = '.'
  c20.bracketHost = false
  c20.port = '47100'
  c20.pathQuery = '/?token=%2'
  c20.suffix = ''
  c20.token = ''
  c20.expectPort = ''
  cases.push(c20)
  const c21 = new PairingCorpusCase()
  c21.id = 'reject-overlong'
  c21.accept = false
  c21.prefix = 'http://'
  c21.hostParts = ['192', '168', '1', '8']
  c21.hostSep = '.'
  c21.bracketHost = false
  c21.port = '47100'
  c21.pathQuery = '/?token=%C0%AF'
  c21.suffix = ''
  c21.token = ''
  c21.expectPort = ''
  cases.push(c21)
  const c22 = new PairingCorpusCase()
  c22.id = 'reject-surrogate-utf8'
  c22.accept = false
  c22.prefix = 'http://'
  c22.hostParts = ['192', '168', '1', '8']
  c22.hostSep = '.'
  c22.bracketHost = false
  c22.port = '47100'
  c22.pathQuery = '/?token=%ED%A0%80'
  c22.suffix = ''
  c22.token = ''
  c22.expectPort = ''
  cases.push(c22)
  const c23 = new PairingCorpusCase()
  c23.id = 'reject-truncated-utf8'
  c23.accept = false
  c23.prefix = 'http://'
  c23.hostParts = ['192', '168', '1', '8']
  c23.hostSep = '.'
  c23.bracketHost = false
  c23.port = '47100'
  c23.pathQuery = '/?token=%E4%BD'
  c23.suffix = ''
  c23.token = ''
  c23.expectPort = ''
  cases.push(c23)
  const c24 = new PairingCorpusCase()
  c24.id = 'reject-empty-fragment'
  c24.accept = false
  c24.prefix = 'http://'
  c24.hostParts = ['192', '168', '1', '8']
  c24.hostSep = '.'
  c24.bracketHost = false
  c24.port = '47100'
  c24.pathQuery = '/?token=abc#'
  c24.suffix = ''
  c24.token = ''
  c24.expectPort = ''
  cases.push(c24)
  const c25 = new PairingCorpusCase()
  c25.id = 'reject-userinfo'
  c25.accept = false
  c25.prefix = 'http://user@'
  c25.hostParts = ['192', '168', '1', '8']
  c25.hostSep = '.'
  c25.bracketHost = false
  c25.port = '47100'
  c25.pathQuery = '/?token=abc'
  c25.suffix = ''
  c25.token = ''
  c25.expectPort = ''
  cases.push(c25)
  const c26 = new PairingCorpusCase()
  c26.id = 'reject-duplicate-token'
  c26.accept = false
  c26.prefix = 'http://'
  c26.hostParts = ['192', '168', '1', '8']
  c26.hostSep = '.'
  c26.bracketHost = false
  c26.port = '47100'
  c26.pathQuery = '/?token=one&token=two'
  c26.suffix = ''
  c26.token = ''
  c26.expectPort = ''
  cases.push(c26)
  const c27 = new PairingCorpusCase()
  c27.id = 'reject-fullwidth-digit-authority'
  c27.accept = false
  c27.prefix = 'http://'
  c27.hostParts = ['\uFF11\uFF19\uFF12', '\uFF11\uFF16\uFF18', '\uFF11', '\uFF18']
  c27.hostSep = '.'
  c27.bracketHost = false
  c27.port = '47100'
  c27.pathQuery = '/?token=abc'
  c27.suffix = ''
  c27.token = ''
  c27.expectPort = ''
  cases.push(c27)
  const c28 = new PairingCorpusCase()
  c28.id = 'reject-fullwidth-dot-authority'
  c28.accept = false
  c28.prefix = 'http://'
  c28.hostParts = ['192', '168', '1', '8']
  c28.hostSep = '\uFF0E'
  c28.bracketHost = false
  c28.port = '47100'
  c28.pathQuery = '/?token=abc'
  c28.suffix = ''
  c28.token = ''
  c28.expectPort = ''
  cases.push(c28)
  const c29 = new PairingCorpusCase()
  c29.id = 'reject-ideographic-dot-authority'
  c29.accept = false
  c29.prefix = 'http://'
  c29.hostParts = ['192', '168', '1', '8']
  c29.hostSep = '\u3002'
  c29.bracketHost = false
  c29.port = '47100'
  c29.pathQuery = '/?token=abc'
  c29.suffix = ''
  c29.token = ''
  c29.expectPort = ''
  cases.push(c29)
  const c30 = new PairingCorpusCase()
  c30.id = 'reject-circled-digit-authority'
  c30.accept = false
  c30.prefix = 'http://'
  c30.hostParts = ['\u2460\u2468\u2461', '\u2460\u2465\u2467', '\u2460', '\u2467']
  c30.hostSep = '.'
  c30.bracketHost = false
  c30.port = '47100'
  c30.pathQuery = '/?token=abc'
  c30.suffix = ''
  c30.token = ''
  c30.expectPort = ''
  cases.push(c30)
  const c31 = new PairingCorpusCase()
  c31.id = 'reject-zwsp-authority'
  c31.accept = false
  c31.prefix = 'http://'
  c31.hostParts = ['192', '\u200B168', '1', '8']
  c31.hostSep = '.'
  c31.bracketHost = false
  c31.port = '47100'
  c31.pathQuery = '/?token=abc'
  c31.suffix = ''
  c31.token = ''
  c31.expectPort = ''
  cases.push(c31)
  const c32 = new PairingCorpusCase()
  c32.id = 'accept-ula-compressed-short'
  c32.accept = true
  c32.prefix = 'http://'
  c32.hostParts = ['fd12', '', '1']
  c32.hostSep = ':'
  c32.bracketHost = true
  c32.port = '47100'
  c32.pathQuery = '/?token=abc'
  c32.suffix = ''
  c32.token = 'abc'
  c32.expectPort = '47100'
  cases.push(c32)
  const c33 = new PairingCorpusCase()
  c33.id = 'reject-ula-trailing-single-colon'
  c33.accept = false
  c33.prefix = 'http://'
  c33.hostParts = ['fd12', '', '1', '']
  c33.hostSep = ':'
  c33.bracketHost = true
  c33.port = '47100'
  c33.pathQuery = '/?token=abc'
  c33.suffix = ''
  c33.token = ''
  c33.expectPort = ''
  cases.push(c33)
  const c34 = new PairingCorpusCase()
  c34.id = 'reject-ula-leading-single-colon'
  c34.accept = false
  c34.prefix = 'http://'
  c34.hostParts = ['', 'fd12', '', '1']
  c34.hostSep = ':'
  c34.bracketHost = true
  c34.port = '47100'
  c34.pathQuery = '/?token=abc'
  c34.suffix = ''
  c34.token = ''
  c34.expectPort = ''
  cases.push(c34)
  const c35 = new PairingCorpusCase()
  c35.id = 'reject-ula-triple-colon'
  c35.accept = false
  c35.prefix = 'http://'
  c35.hostParts = ['fd12', '', '', '1']
  c35.hostSep = ':'
  c35.bracketHost = true
  c35.port = '47100'
  c35.pathQuery = '/?token=abc'
  c35.suffix = ''
  c35.token = ''
  c35.expectPort = ''
  cases.push(c35)
  return cases
}
