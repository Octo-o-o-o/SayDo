package com.octoooo.saydo

import java.net.URI
import java.nio.ByteBuffer
import java.nio.charset.CharacterCodingException
import java.nio.charset.CodingErrorAction
import java.nio.charset.StandardCharsets
import java.util.UUID

data class DesktopProfile(
    val id: String = UUID.randomUUID().toString(),
    val name: String,
    val url: String,
    val token: String,
) {
    val authenticatedUrl: String
        get() = "$url?token=${percentEncode(token)}"

    companion object {
        fun fromPairingUrl(value: String): DesktopProfile {
            val trimmed = asciiTrim(value)
            if (
                !trimmed.startsWith("http://", ignoreCase = true) ||
                trimmed.startsWith("https://", ignoreCase = true) ||
                trimmed.contains('@') ||
                trimmed.contains('#')
            ) {
                throw PairingUrlValidationException()
            }
            val queryIndex = trimmed.indexOf('?')
            if (queryIndex < 0) {
                throw PairingUrlValidationException()
            }
            val token = uniqueToken(trimmed.substring(queryIndex + 1))
            assertRawAsciiAuthority(trimmed)

            val uri = runCatching { URI(trimmed) }.getOrNull()
                ?: throw PairingUrlValidationException()

            if (
                !uri.scheme.equals("http", ignoreCase = true) ||
                uri.rawUserInfo != null ||
                uri.port !in 1..65535 ||
                uri.rawFragment != null
            ) {
                throw PairingUrlValidationException()
            }

            val path = uri.rawPath.orEmpty()
            if (path.isNotEmpty() && path != "/") {
                throw PairingUrlValidationException()
            }

            val host = uri.host ?: throw PairingUrlValidationException()
            val authority = uri.rawAuthority ?: throw PairingUrlValidationException()
            if (unbracketedHost(host).contains(':') && !authority.startsWith("[")) {
                throw PairingUrlValidationException()
            }
            if (!isPrivateLanHost(host)) {
                throw PairingUrlValidationException()
            }

            val baseUrl = buildBaseUrl(host, uri.port)
            return DesktopProfile(
                name = "${unbracketedHost(host)}:${uri.port}",
                url = baseUrl,
                token = token,
            )
        }

        private fun uniqueToken(rawQuery: String?): String {
            if (rawQuery.isNullOrEmpty()) {
                throw PairingUrlValidationException()
            }
            val pairs = rawQuery.split('&')
            if (pairs.isEmpty() || pairs.any { it.isEmpty() }) {
                throw PairingUrlValidationException()
            }
            var token: String? = null
            for (part in pairs) {
                val separator = part.indexOf('=')
                if (separator <= 0) {
                    throw PairingUrlValidationException()
                }
                val rawName = part.substring(0, separator)
                val rawValue = part.substring(separator + 1)
                assertRawQueryAtom(rawName)
                assertRawQueryAtom(rawValue)
                val name = percentDecode(rawName)
                val value = percentDecode(rawValue)
                if (name != "token") {
                    throw PairingUrlValidationException()
                }
                if (token != null || value.isEmpty()) {
                    throw PairingUrlValidationException()
                }
                token = value
            }
            return token ?: throw PairingUrlValidationException()
        }

        private fun buildBaseUrl(host: String, port: Int): String {
            val raw = unbracketedHost(host)
            val formatted = if (raw.contains(':')) "[$raw]" else raw
            return "http://$formatted:$port/"
        }

        private fun unbracketedHost(host: String): String =
            if (host.startsWith('[') && host.endsWith(']')) host.substring(1, host.length - 1) else host

        internal fun isPrivateLanHost(host: String): Boolean {
            val value = unbracketedHost(host)
            return isRfc1918Ipv4(value) || isUniqueLocalIpv6(value)
        }

        private fun isRfc1918Ipv4(host: String): Boolean {
            if (!isIpv4Address(host)) return false
            val parts = host.split('.').map { it.toIntOrNull() ?: return false }
            return when {
                parts[0] == 10 -> true
                parts[0] == 192 && parts[1] == 168 -> true
                parts[0] == 172 && parts[1] in 16..31 -> true
                else -> false
            }
        }

        private fun isIpv4Address(host: String): Boolean {
            val parts = host.split('.')
            if (parts.size != 4) return false
            for (part in parts) {
                if (part.isEmpty() || (part.length > 1 && part[0] == '0')) return false
                if (part.any { it !in '0'..'9' }) return false
                val value = part.toIntOrNull() ?: return false
                if (value !in 0..255) return false
            }
            return true
        }

        private fun isUniqueLocalIpv6(host: String): Boolean {
            if (!isIpv6Address(host)) return false
            val first = host.substringBefore(':')
            if (first.isEmpty()) return false
            val value = first.toIntOrNull(16) ?: return false
            return value in 0xfc00..0xfdff
        }

        private fun isIpv6Address(host: String): Boolean {
            var value = unbracketedHost(host)
            if (value.contains('.')) return false
            if (!value.contains(':')) return false
            for (index in value.indices) {
                val code = value[index].code
                val hex = code in 0x30..0x39 || code in 0x41..0x46 || code in 0x61..0x66
                if (!hex && code != 0x3a) return false
            }
            val compression = value.indexOf("::")
            if (compression >= 0) {
                if (compression != value.lastIndexOf("::")) return false
                val left = value.substring(0, compression)
                val right = value.substring(compression + 2)
                val leftParts = if (left.isEmpty()) emptyList() else left.split(':')
                val rightParts = if (right.isEmpty()) emptyList() else right.split(':')
                return leftParts.size + rightParts.size < 8 &&
                    areValidIpv6Parts(leftParts) &&
                    areValidIpv6Parts(rightParts)
            }
            val parts = value.split(':')
            return parts.size == 8 && areValidIpv6Parts(parts)
        }

        private fun areValidIpv6Parts(parts: List<String>): Boolean =
            parts.all { it.isNotEmpty() && it.length <= 4 }

        private fun assertRawAsciiAuthority(trimmed: String) {
            if (trimmed.length < 7) throw PairingUrlValidationException()
            val rest = trimmed.substring(7)
            var index = 0
            var inBrackets = false
            var sawChar = false
            while (index < rest.length) {
                val cp = rest.codePointAt(index)
                if (!inBrackets && (cp == '/'.code || cp == '?'.code)) break
                if (cp < 0x21 || cp > 0x7e) throw PairingUrlValidationException()
                sawChar = true
                if (cp == '['.code) inBrackets = true
                if (cp == ']'.code) inBrackets = false
                index += Character.charCount(cp)
            }
            if (!sawChar) throw PairingUrlValidationException()
        }

        private fun asciiTrim(value: String): String {
            var start = 0
            var end = value.length
            while (start < end && isAsciiWs(value[start].code)) start += 1
            while (end > start && isAsciiWs(value[end - 1].code)) end -= 1
            return value.substring(start, end)
        }

        private fun isAsciiWs(code: Int): Boolean =
            code == 0x20 || code == 0x09 || code == 0x0d || code == 0x0a

        private fun isUnreserved(code: Int): Boolean =
            code in 0x41..0x5a || code in 0x61..0x7a || code in 0x30..0x39 ||
                code == 0x2d || code == 0x2e || code == 0x5f || code == 0x7e

        private fun assertRawQueryAtom(raw: String) {
            if (raw.isEmpty()) throw PairingUrlValidationException()
            var index = 0
            while (index < raw.length) {
                val code = raw[index].code
                if (code == 0x25) {
                    if (index + 2 >= raw.length) throw PairingUrlValidationException()
                    val hex = raw.substring(index + 1, index + 3)
                    if (hex.any { it !in '0'..'9' && it !in 'a'..'f' && it !in 'A'..'F' }) {
                        throw PairingUrlValidationException()
                    }
                    index += 3
                    continue
                }
                if (!isUnreserved(code)) throw PairingUrlValidationException()
                index += 1
            }
        }

        internal fun percentDecode(value: String): String {
            val bytes = ArrayList<Byte>(value.length)
            var index = 0
            while (index < value.length) {
                val current = value[index]
                if (current == '%') {
                    if (index + 2 >= value.length) {
                        throw PairingUrlValidationException()
                    }
                    val hex = value.substring(index + 1, index + 3)
                    if (hex.any { it !in '0'..'9' && it !in 'a'..'f' && it !in 'A'..'F' }) {
                        throw PairingUrlValidationException()
                    }
                    bytes += hex.toInt(16).toByte()
                    index += 3
                    continue
                }
                if (!isUnreserved(current.code)) {
                    throw PairingUrlValidationException()
                }
                bytes += current.code.toByte()
                index += 1
            }
            return utf8String(bytes.toByteArray())
        }

        private fun utf8String(bytes: ByteArray): String {
            val decoder = StandardCharsets.UTF_8.newDecoder()
                .onMalformedInput(CodingErrorAction.REPORT)
                .onUnmappableCharacter(CodingErrorAction.REPORT)
            try {
                return decoder.decode(ByteBuffer.wrap(bytes)).toString()
            } catch (_: CharacterCodingException) {
                throw PairingUrlValidationException()
            }
        }

        internal fun percentEncode(value: String): String {
            val bytes = utf8BytesFromScalars(value)
            return buildString {
                for (byte in bytes) {
                    val unsigned = byte.toInt() and 0xff
                    if (isUnreserved(unsigned)) {
                        append(unsigned.toChar())
                    } else {
                        append('%')
                        append(unsigned.toString(16).uppercase().padStart(2, '0'))
                    }
                }
            }
        }

        private fun utf8BytesFromScalars(value: String): ByteArray {
            val out = ArrayList<Byte>(value.length)
            var index = 0
            while (index < value.length) {
                val cp = value.codePointAt(index)
                if (cp in 0xd800..0xdfff) throw PairingUrlValidationException()
                when {
                    cp <= 0x7f -> out.add(cp.toByte())
                    cp <= 0x7ff -> {
                        out.add((0xc0 or (cp shr 6)).toByte())
                        out.add((0x80 or (cp and 0x3f)).toByte())
                    }
                    cp <= 0xffff -> {
                        out.add((0xe0 or (cp shr 12)).toByte())
                        out.add((0x80 or ((cp shr 6) and 0x3f)).toByte())
                        out.add((0x80 or (cp and 0x3f)).toByte())
                    }
                    cp <= 0x10ffff -> {
                        out.add((0xf0 or (cp shr 18)).toByte())
                        out.add((0x80 or ((cp shr 12) and 0x3f)).toByte())
                        out.add((0x80 or ((cp shr 6) and 0x3f)).toByte())
                        out.add((0x80 or (cp and 0x3f)).toByte())
                    }
                    else -> throw PairingUrlValidationException()
                }
                index += Character.charCount(cp)
            }
            return out.toByteArray()
        }
    }
}

class PairingUrlValidationException : IllegalArgumentException(
    "二维码不是 SayDo 桌面配对地址，请重新扫描",
)
