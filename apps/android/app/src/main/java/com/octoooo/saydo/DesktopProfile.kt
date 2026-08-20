package com.octoooo.saydo

import java.net.URI
import java.nio.charset.StandardCharsets
import java.util.UUID

data class DesktopProfile(
    val id: String = UUID.randomUUID().toString(),
    val name: String,
    val url: String,
    val token: String,
) {
    val authenticatedUrl: String
        get() {
            val uri = URI(url)
            val queryParts = uri.rawQuery
                ?.split('&')
                ?.filterNot { queryName(it) == "token" }
                .orEmpty()
                .toMutableList()
            queryParts += "token=${percentEncode(token)}"
            return buildUrl(uri, queryParts)
        }

    companion object {
        fun fromPairingUrl(value: String): DesktopProfile {
            val uri = runCatching { URI(value) }.getOrNull()
                ?: throw PairingUrlValidationException()
            val token = uri.rawQuery
                ?.split('&')
                ?.firstOrNull { queryName(it) == "token" }
                ?.substringAfter('=', "")
                ?.let(::percentDecode)

            if (
                !uri.scheme.equals("http", ignoreCase = true) ||
                uri.host.isNullOrBlank() ||
                uri.rawUserInfo != null ||
                uri.port == -1 ||
                token.isNullOrEmpty()
            ) {
                throw PairingUrlValidationException()
            }

            val queryParts = uri.rawQuery
                ?.split('&')
                ?.filterNot { queryName(it) == "token" }
                .orEmpty()
            val baseUrl = buildUrl(uri, queryParts)
            return DesktopProfile(
                name = "${uri.host}:${uri.port}",
                url = baseUrl,
                token = token,
            )
        }

        private fun buildUrl(uri: URI, queryParts: List<String>): String = buildString {
            append("http://")
            append(uri.rawAuthority)
            append(uri.rawPath.orEmpty())
            if (queryParts.isNotEmpty()) {
                append('?')
                append(queryParts.joinToString("&"))
            }
        }

        private fun queryName(part: String): String = percentDecode(part.substringBefore('='))

        private fun percentDecode(value: String): String {
            val bytes = ArrayList<Byte>(value.length)
            var index = 0
            while (index < value.length) {
                if (value[index] == '%' && index + 2 < value.length) {
                    val decoded = value.substring(index + 1, index + 3).toIntOrNull(16)
                    if (decoded != null) {
                        bytes += decoded.toByte()
                        index += 3
                        continue
                    }
                }
                value[index].toString().toByteArray(StandardCharsets.UTF_8).forEach(bytes::add)
                index += 1
            }
            return bytes.toByteArray().toString(StandardCharsets.UTF_8)
        }

        private fun percentEncode(value: String): String = buildString {
            value.toByteArray(StandardCharsets.UTF_8).forEach { byte ->
                val unsigned = byte.toInt() and 0xff
                val character = unsigned.toChar()
                if (
                    character in 'a'..'z' || character in 'A'..'Z' ||
                    character in '0'..'9' || character in "-._~"
                ) {
                    append(character)
                } else {
                    append('%')
                    append(unsigned.toString(16).uppercase().padStart(2, '0'))
                }
            }
        }
    }
}

class PairingUrlValidationException : IllegalArgumentException(
    "二维码不是 SayDo 桌面配对地址，请重新扫描",
)
