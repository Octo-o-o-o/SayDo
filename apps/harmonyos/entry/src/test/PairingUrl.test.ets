import { describe, it, expect } from '@ohos/hypium'
import { parsePairingUrl, percentEncode } from '../main/ets/model/pairingUrl'
import { pairingCorpusCases, pairingCorpusExpectedName, pairingCorpusInput } from './PairingUrlCorpus'

export default function pairingUrlTest() {
  describe('pairingUrl', () => {
    it('accepts_rfc1918_ipv4', 0, () => {
      const hosts: Array<string> = ['10.0.0.1', '172.16.0.1', '172.31.255.1', '192.168.1.8']
      for (let i = 0; i < hosts.length; i++) {
        const host = hosts[i]
        const parsed = parsePairingUrl('http://' + host + ':47100/?token=abc')
        expect(parsed.token).assertEqual('abc')
        expect(parsed.baseUrl).assertEqual('http://' + host + ':47100/')
        expect(parsed.name).assertEqual(host + ':47100')
      }
      const trimmed = parsePairingUrl('\n\t http://192.168.1.8:47100/?token=abc \r\n')
      expect(trimmed.token).assertEqual('abc')
      expect(trimmed.name).assertEqual('192.168.1.8:47100')
      const leadingZeroPort = parsePairingUrl('http://192.168.1.8:047100/?token=abc')
      expect(leadingZeroPort.name).assertEqual('192.168.1.8:47100')
      expect(leadingZeroPort.baseUrl).assertEqual('http://192.168.1.8:47100/')
    })

    it('accepts_unique_local_ipv6', 0, () => {
      const parsed = parsePairingUrl('http://[fd12:3456:789a:1::1]:47100/?token=abc')
      expect(parsed.token).assertEqual('abc')
      expect(parsed.name).assertEqual('fd12:3456:789a:1::1:47100')
      expect(parsed.baseUrl).assertEqual('http://[fd12:3456:789a:1::1]:47100/')
    })

    it('percent_encodes_and_decodes_token', 0, () => {
      const parsed = parsePairingUrl('http://192.168.1.8:47100/?token=a%2Fb%20c%2Bd')
      expect(parsed.token).assertEqual('a/b c+d')
      const roundTrip = parsePairingUrl(
        'http://192.168.1.8:47100/?token=' + percentEncode('token/+space%')
      )
      expect(roundTrip.token).assertEqual('token/+space%')
      const bmpEncoded = parsePairingUrl('http://192.168.1.8:47100/?token=%E4%BD%A0%E5%A5%BD')
      expect(bmpEncoded.token).assertEqual('\u4F60\u597D')
    })

    it('shared_corpus_accept_and_reject', 0, () => {
      const cases = pairingCorpusCases()
      expect(cases.length > 0).assertTrue()
      for (let i = 0; i < cases.length; i++) {
        const item = cases[i]
        const input = pairingCorpusInput(item)
        if (item.accept) {
          const parsed = parsePairingUrl(input)
          expect(parsed.token).assertEqual(item.token)
          expect(parsed.name).assertEqual(pairingCorpusExpectedName(item))
        } else {
          reject(input)
        }
      }
    })

    it('rejects_duplicate_token', 0, () => {
      reject('http://192.168.1.8:47100/?token=one&token=two')
    })

    it('rejects_userinfo', 0, () => {
      reject('http://user:pass@192.168.1.8:47100/?token=abc')
      reject('http://user@192.168.1.8:47100/?token=abc')
    })

    it('rejects_missing_port', 0, () => {
      reject('http://192.168.1.8/?token=abc')
      reject('http://[fd00::1]/?token=abc')
    })

    it('rejects_non_http', 0, () => {
      reject('https://192.168.1.8:47100/?token=abc')
      reject('ftp://192.168.1.8:47100/?token=abc')
    })

    it('rejects_extra_query_parameters', 0, () => {
      reject('http://192.168.1.8:47100/?token=abc&foo=1')
    })

    it('rejects_malformed_percent_encoding', 0, () => {
      reject('http://192.168.1.8:47100/?token=%')
      reject('http://192.168.1.8:47100/?token=%2')
      reject('http://192.168.1.8:47100/?token=%zz')
      reject('http://192.168.1.8:47100/?token=%2G')
    })

    it('rejects_malformed_compressed_ipv6', 0, () => {
      reject('http://[fd12::1:]:47100/?token=abc')
      reject('http://[:fd12::1]:47100/?token=abc')
      reject('http://[fd12:::1]:47100/?token=abc')
      const accepted = parsePairingUrl('http://[fd12::1]:47100/?token=abc')
      expect(accepted.token).assertEqual('abc')
      expect(accepted.name).assertEqual('fd12::1:47100')
    })

    it('rejects_public_loopback_and_cgnat', 0, () => {
      reject('http://8.8.8.8:47100/?token=abc')
      reject('http://127.0.0.1:47100/?token=abc')
      reject('http://100.64.0.1:47100/?token=abc')
      reject('http://example.local:47100/?token=abc')
      reject('http://[::1]:47100/?token=abc')
      reject('http://[2001:db8::1]:47100/?token=abc')
    })

    it('accepts_unicode_and_non_bmp_token', 0, () => {
      const bmp = '\u4F60\u597D'
      const bmpParsed = parsePairingUrl('http://192.168.1.8:47100/?token=' + percentEncode(bmp))
      expect(bmpParsed.token).assertEqual(bmp)
      const nonBmp = String.fromCharCode(0xD800) + String.fromCharCode(0xDC00)
      expect(percentEncode(nonBmp)).assertEqual('%F0%90%80%80')
      const nonBmpParsed = parsePairingUrl('http://192.168.1.8:47100/?token=' + percentEncode(nonBmp))
      expect(nonBmpParsed.token).assertEqual(nonBmp)
      let unpairedHigh = false
      try {
        percentEncode(String.fromCharCode(0xD800))
      } catch (_high) {
        unpairedHigh = true
      }
      expect(unpairedHigh).assertTrue()
      let unpairedLow = false
      try {
        percentEncode(String.fromCharCode(0xDC00))
      } catch (_low) {
        unpairedLow = true
      }
      expect(unpairedLow).assertTrue()
    })

    it('rejects_illegal_utf8_and_unbracketed_ipv6', 0, () => {
      reject('http://192.168.1.8:47100/?token=%C0%AF')
      reject('http://192.168.1.8:47100/?token=%ED%A0%80')
      reject('http://192.168.1.8:47100/?token=%E4%BD')
      reject('http://192.168.1.8:47100/?token=%F0%90%80')
      reject('http://fd00::1:47100/?token=abc')
      reject('http://fd12:3456:789a:1::1:47100/?token=abc')
      reject('http://[fd12:3456:789a:1::1:47100/?token=abc')
      reject('http://fd12:3456:789a:1::1]:47100/?token=abc')
      reject('http://[[fd12:3456:789a:1::1]]:47100/?token=abc')
      reject('http://fd12:3456:789a:1::1:47100/?token=abc[x]')
      reject('http://fd12:3456:789a:1::1:47100/?token=abc%5Bx%5D')
      reject('http://fd00::1:47100/?token=%5Babc%5D')
      reject('http://fd12:3456:789a:1::1:47100/[/]?token=abc')
      reject('http://fd12:3456:789a:1::1:47100/%5Bx%5D?token=abc')
      reject('http://192.168.1.8:47100/?token=abc#')
      reject('http://192.168.1.8:00000/?token=abc')
      reject('http://192.168.1.8:65536/?token=abc')
      let longOctet = ''
      for (let i = 0; i < 40; i++) {
        longOctet += '9'
      }
      reject('http://192.168.1.' + longOctet + ':47100/?token=abc')
    })
  })
}

function reject(url: string): void {
  let threw = false
  try {
    parsePairingUrl(url)
  } catch (_e) {
    threw = true
  }
  expect(threw).assertTrue()
}
