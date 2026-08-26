package com.octoooo.saydo

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test

class DesktopProfileTest {
    @Test
    fun acceptsPrivateIpv4Addresses() {
        val hosts = listOf("10.0.0.1", "10.255.255.254", "172.16.0.1", "172.31.255.1", "192.168.0.1", "192.168.1.8")
        for (host in hosts) {
            val profile = DesktopProfile.fromPairingUrl("http://$host:47100/?token=abc")
            assertEquals("$host:47100", profile.name)
            assertEquals("http://$host:47100/", profile.url)
            assertEquals("abc", profile.token)
        }
    }

    @Test
    fun acceptsUniqueLocalIpv6Addresses() {
        val profile = DesktopProfile.fromPairingUrl("http://[fd12:3456:789a:1::1]:47100/?token=abc")
        assertEquals("fd12:3456:789a:1::1:47100", profile.name)
        assertEquals("http://[fd12:3456:789a:1::1]:47100/", profile.url)
        assertEquals("abc", profile.token)
        assertTrue(!profile.name.contains("[") && !profile.name.contains("]"))

        val fc = DesktopProfile.fromPairingUrl("http://[fc00::1]:47100/?token=abc")
        assertEquals("fc00::1:47100", fc.name)
        assertEquals("http://[fc00::1]:47100/", fc.url)
    }

    @Test
    fun sharedCorpusAcceptAndReject() {
        assertTrue(PairingUrlCorpus.cases.isNotEmpty())
        for (item in PairingUrlCorpus.cases) {
            val input = item.input()
            if (item.accept) {
                val profile = DesktopProfile.fromPairingUrl(input)
                assertEquals(item.id, item.token, profile.token)
                assertEquals(item.id, item.expectedName(), profile.name)
            } else {
                try {
                    DesktopProfile.fromPairingUrl(input)
                    fail("expected rejection: ${item.id}")
                } catch (_: PairingUrlValidationException) {
                    // expected
                }
            }
        }
    }

    @Test
    fun percentEncodesAndDecodesToken() {
        val encoded = DesktopProfile.fromPairingUrl("http://192.168.1.8:47100/?token=a%2Fb%20c%2Bd")
        assertEquals("a/b c+d", encoded.token)
        assertTrue(encoded.authenticatedUrl.contains("token=a%2Fb%20c%2Bd"))

        val roundTrip = DesktopProfile.fromPairingUrl(
            "http://192.168.1.8:47100/?token=${DesktopProfile.percentEncode("token/+space%")}",
        )
        assertEquals("token/+space%", roundTrip.token)
        assertEquals(
            "http://192.168.1.8:47100/?token=token%2F%2Bspace%25",
            roundTrip.authenticatedUrl,
        )
    }

    @Test
    fun rejectsDuplicateToken() {
        reject("http://192.168.1.8:47100/?token=one&token=two")
    }

    @Test
    fun rejectsUserInfo() {
        reject("http://user:pass@192.168.1.8:47100/?token=abc")
        reject("http://user@192.168.1.8:47100/?token=abc")
    }

    @Test
    fun rejectsMissingPort() {
        reject("http://192.168.1.8/?token=abc")
        reject("http://192.168.1.8?token=abc")
        reject("http://[fd00::1]/?token=abc")
    }

    @Test
    fun rejectsNonHttp() {
        reject("https://192.168.1.8:47100/?token=abc")
        reject("ftp://192.168.1.8:47100/?token=abc")
        reject("192.168.1.8:47100/?token=abc")
    }

    @Test
    fun rejectsExtraQueryParameters() {
        reject("http://192.168.1.8:47100/?token=abc&foo=1")
        reject("http://192.168.1.8:47100/?foo=1&token=abc")
    }

    @Test
    fun rejectsMalformedPercentEncoding() {
        reject("http://192.168.1.8:47100/?token=%")
        reject("http://192.168.1.8:47100/?token=%2")
        reject("http://192.168.1.8:47100/?token=%zz")
        reject("http://192.168.1.8:47100/?token=%2G")
        reject("http://192.168.1.8:47100/?token=a%2")
    }

    @Test
    fun rejectsMalformedCompressedIpv6() {
        reject("http://[fd12::1:]:47100/?token=abc")
        reject("http://[:fd12::1]:47100/?token=abc")
        reject("http://[fd12:::1]:47100/?token=abc")
        val accepted = DesktopProfile.fromPairingUrl("http://[fd12::1]:47100/?token=abc")
        assertEquals("abc", accepted.token)
        assertEquals("fd12::1:47100", accepted.name)
    }

    @Test
    fun rejectsPublicLoopbackAndCgnatHosts() {
        reject("http://8.8.8.8:47100/?token=abc")
        reject("http://127.0.0.1:47100/?token=abc")
        reject("http://100.64.0.1:47100/?token=abc")
        reject("http://172.15.0.1:47100/?token=abc")
        reject("http://172.32.0.1:47100/?token=abc")
        reject("http://169.254.1.1:47100/?token=abc")
        reject("http://example.local:47100/?token=abc")
        reject("http://[::1]:47100/?token=abc")
        reject("http://[2001:db8::1]:47100/?token=abc")
    }

    @Test
    fun rejectsEmptyTokenPathAndFragment() {
        reject("http://192.168.1.8:47100/?token=")
        reject("http://192.168.1.8:47100/")
        reject("http://192.168.1.8:47100/?token=abc#frag")
        reject("http://192.168.1.8:47100/m/?token=abc")
    }

    @Test
    fun acceptsUnicodeAndNonBmpTokenRoundTrip() {
        val bmp = "\u4F60\u597D"
        val bmpProfile = DesktopProfile.fromPairingUrl(
            "http://192.168.1.8:47100/?token=${DesktopProfile.percentEncode(bmp)}",
        )
        assertEquals(bmp, bmpProfile.token)

        val nonBmp = "\uD800\uDC00"
        val nonBmpProfile = DesktopProfile.fromPairingUrl(
            "http://192.168.1.8:47100/?token=${DesktopProfile.percentEncode(nonBmp)}",
        )
        assertEquals(nonBmp, nonBmpProfile.token)
        assertTrue(nonBmpProfile.authenticatedUrl.contains("%F0%90%80%80"))
    }

    @Test
    fun trimsSurroundingWhitespaceBeforeParse() {
        val profile = DesktopProfile.fromPairingUrl("\n\t http://192.168.1.8:47100/?token=abc \r\n")
        assertEquals("abc", profile.token)
        assertEquals("192.168.1.8:47100", profile.name)
        assertEquals("http://192.168.1.8:47100/", profile.url)
    }

    @Test
    fun acceptsLeadingZeroPortAndNormalizes() {
        val profile = DesktopProfile.fromPairingUrl("http://192.168.1.8:047100/?token=abc")
        assertEquals("192.168.1.8:47100", profile.name)
        assertEquals("http://192.168.1.8:47100/", profile.url)
    }

    @Test
    fun rejectsEmptyFragmentZeroAndOverflowPorts() {
        reject("http://192.168.1.8:47100/?token=abc#")
        reject("http://192.168.1.8:47100/?token=abc#frag")
        reject("http://192.168.1.8:00000/?token=abc")
        reject("http://192.168.1.8:0/?token=abc")
        reject("http://192.168.1.8:65536/?token=abc")
        reject("http://192.168.1.8:99a/?token=abc")
    }

    @Test
    fun oversizedIpv4OctetIsIllegalHostNotNumericException() {
        val host = "192.168.1." + "9".repeat(40)
        try {
            assertTrue(!DesktopProfile.isPrivateLanHost(host))
        } catch (thrown: NumberFormatException) {
            fail("NumberFormatException escaped for oversized IPv4 octet: ${thrown.message}")
        }
        try {
            DesktopProfile.fromPairingUrl("http://$host:47100/?token=abc")
            fail("expected rejection: oversized IPv4 octet")
        } catch (_: PairingUrlValidationException) {
            // expected
        } catch (thrown: Throwable) {
            fail("expected PairingUrlValidationException, got ${thrown::class.java.name}")
        }
    }

    @Test
    fun rejectsIllegalUtf8AndUnbracketedIpv6() {
        reject("http://192.168.1.8:47100/?token=%C0%AF")
        reject("http://192.168.1.8:47100/?token=%ED%A0%80")
        reject("http://192.168.1.8:47100/?token=%E4%BD")
        reject("http://192.168.1.8:47100/?token=%F0%90%80")
        reject("http://fd00::1:47100/?token=abc")
        reject("http://fd12:3456:789a:1::1:47100/?token=abc")
        reject("http://[fd12:3456:789a:1::1:47100/?token=abc")
        reject("http://fd12:3456:789a:1::1]:47100/?token=abc")
        reject("http://[[fd12:3456:789a:1::1]]:47100/?token=abc")
        reject("http://fd12:3456:789a:1::1:47100/?token=abc[x]")
        reject("http://fd12:3456:789a:1::1:47100/?token=abc%5Bx%5D")
        reject("http://fd00::1:47100/?token=%5Babc%5D")
        reject("http://fd12:3456:789a:1::1:47100/[/]?token=abc")
        reject("http://fd12:3456:789a:1::1:47100/%5Bx%5D?token=abc")
    }

    private fun reject(url: String) {
        try {
            DesktopProfile.fromPairingUrl(url)
            fail("expected rejection: $url")
        } catch (_: PairingUrlValidationException) {
            // expected
        }
    }
}
