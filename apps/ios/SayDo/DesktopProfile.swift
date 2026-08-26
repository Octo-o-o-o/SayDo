import Foundation

struct DesktopProfile: Identifiable, Codable, Equatable {
    let id: UUID
    var name: String
    var url: URL
    var token: String

    init(id: UUID = UUID(), name: String, url: URL, token: String) {
        self.id = id
        self.name = name
        self.url = url
        self.token = token
    }

    init(pairingURLString value: String) throws {
        let trimmed = PairingPercentCoding.asciiTrim(value)
        let lowered = trimmed.lowercased()
        guard lowered.hasPrefix("http://"), !lowered.hasPrefix("https://") else {
            throw PairingURLValidationError.invalidFormat
        }
        if trimmed.contains("@") || trimmed.contains("#") {
            throw PairingURLValidationError.invalidFormat
        }
        guard let queryIndex = trimmed.firstIndex(of: "?") else {
            throw PairingURLValidationError.invalidFormat
        }
        let token = try Self.uniqueToken(from: String(trimmed[trimmed.index(after: queryIndex)...]))
        try Self.assertRawAsciiAuthority(trimmed)
        let rawHost = try Self.rawAuthorityHost(from: trimmed)
        guard PairingLANAddress.isPrivate(rawHost) else {
            throw PairingURLValidationError.invalidFormat
        }
        try Self.rejectMalformedPercentEscapes(in: trimmed)
        guard let pairingURL = URL(string: trimmed) else {
            throw PairingURLValidationError.invalidFormat
        }
        try self.init(pairingURL: pairingURL, tokenOverride: token, expectedHost: rawHost)
    }

    /// Foundation `URL(string:)` 会把全角数字/句点、圈号数字、U+200B 等归一成 ASCII 私网 IPv4。
    /// 必须在交给 URL 之前要求原始 authority 仅为可打印 ASCII。
    private static func assertRawAsciiAuthority(_ trimmed: String) throws {
        guard trimmed.lowercased().hasPrefix("http://") else {
            throw PairingURLValidationError.invalidFormat
        }
        let rest = String(trimmed.dropFirst(7))
        var inBrackets = false
        var index = rest.unicodeScalars.startIndex
        let end = rest.unicodeScalars.endIndex
        var sawChar = false
        while index < end {
            let value = rest.unicodeScalars[index].value
            if !inBrackets && (value == 0x2F || value == 0x3F) {
                break
            }
            guard (0x21...0x7E).contains(value) else {
                throw PairingURLValidationError.invalidFormat
            }
            sawChar = true
            if value == 0x5B { inBrackets = true }
            if value == 0x5D { inBrackets = false }
            index = rest.unicodeScalars.index(after: index)
        }
        guard sawChar else {
            throw PairingURLValidationError.invalidFormat
        }
    }

    /// Foundation `URL(string:)` 会把非法 `%` 重写成 `%25…`，必须在构造 URL 前校验原始字符串。
    private static func rejectMalformedPercentEscapes(in value: String) throws {
        var index = value.startIndex
        while index < value.endIndex {
            if value[index] == "%" {
                guard let hexEnd = value.index(index, offsetBy: 3, limitedBy: value.endIndex) else {
                    throw PairingURLValidationError.invalidFormat
                }
                let hex = value[value.index(after: index)..<hexEnd]
                guard hex.count == 2,
                      hex.unicodeScalars.allSatisfy({ CharacterSet(charactersIn: "0123456789abcdefABCDEF").contains($0) }) else {
                    throw PairingURLValidationError.invalidFormat
                }
                index = hexEnd
                continue
            }
            index = value.index(after: index)
        }
    }

    init(pairingURL: URL) throws {
        try self.init(pairingURL: pairingURL, tokenOverride: nil)
    }

    private init(pairingURL: URL, tokenOverride: String?, expectedHost: String? = nil) throws {
        guard var components = URLComponents(url: pairingURL, resolvingAgainstBaseURL: false),
              components.scheme?.lowercased() == "http",
              let encodedHost = components.percentEncodedHost,
              !encodedHost.isEmpty,
              components.user == nil,
              components.password == nil,
              let port = components.port,
              (1...65535).contains(port),
              components.fragment == nil,
              components.percentEncodedFragment == nil else {
            throw PairingURLValidationError.invalidFormat
        }

        let lanHost = try Self.lanHost(fromPercentEncodedHost: encodedHost)
        if let expectedHost, lanHost.lowercased() != expectedHost.lowercased() {
            throw PairingURLValidationError.invalidFormat
        }
        let path = components.percentEncodedPath
        guard path.isEmpty || path == "/",
              PairingLANAddress.isPrivate(lanHost) else {
            throw PairingURLValidationError.invalidFormat
        }

        let token: String
        if let tokenOverride {
            token = tokenOverride
        } else {
            token = try Self.uniqueToken(from: components.percentEncodedQuery)
        }
        components.percentEncodedQuery = nil
        components.queryItems = nil
        components.fragment = nil
        components.path = "/"
        components.port = port
        // IPv6 的 percentEncodedHost 在本系统含 []；不得再写入带括号的 percentEncodedHost（Foundation 会视为非法字符）。
        // 保留已校验的 authority host，让序列化继续产出合法 bracketed IPv6。
        guard let baseURL = components.url else {
            throw PairingURLValidationError.invalidFormat
        }
        self.init(name: "\(lanHost):\(port)", url: baseURL, token: token)
    }

    /// IPv6 是否带 authority brackets 只看 `percentEncodedHost`，不扫完整 URL。
    /// 去掉且只去掉一对括号后用于 LAN 校验和展示名；base URL 仍写回合法 bracketed IPv6。
    private static func lanHost(fromPercentEncodedHost encodedHost: String) throws -> String {
        if encodedHost.contains(":") {
            guard encodedHost.hasPrefix("["),
                  encodedHost.hasSuffix("]"),
                  encodedHost.count >= 4 else {
                throw PairingURLValidationError.invalidFormat
            }
            let inner = String(encodedHost.dropFirst().dropLast())
            guard !inner.isEmpty,
                  !inner.contains("["),
                  !inner.contains("]") else {
                throw PairingURLValidationError.invalidFormat
            }
            return inner
        }
        guard !encodedHost.contains("["), !encodedHost.contains("]") else {
            throw PairingURLValidationError.invalidFormat
        }
        return encodedHost
    }

    /// Raw authority host before Foundation. Bracketed IPv6 is checked here so a trailing
    /// empty hextet cannot be stripped then accepted as ULA.
    private static func rawAuthorityHost(from trimmed: String) throws -> String {
        let rest = String(trimmed.dropFirst(7))
        if rest.first == "[" {
            guard let close = rest.firstIndex(of: "]") else {
                throw PairingURLValidationError.invalidFormat
            }
            let inner = String(rest[rest.index(after: rest.startIndex)..<close])
            guard !inner.isEmpty else {
                throw PairingURLValidationError.invalidFormat
            }
            return inner
        }
        guard let colon = rest.firstIndex(of: ":") else {
            throw PairingURLValidationError.invalidFormat
        }
        return String(rest[..<colon])
    }

    var authenticatedURL: URL {
        guard var components = URLComponents(url: url, resolvingAgainstBaseURL: false) else {
            return url
        }
        components.percentEncodedQuery = "token=\(PairingPercentCoding.encode(token))"
        return components.url ?? url
    }

    private static func uniqueToken(from rawQuery: String?) throws -> String {
        guard let rawQuery, !rawQuery.isEmpty else {
            throw PairingURLValidationError.invalidFormat
        }
        let pairs = rawQuery.split(separator: "&", omittingEmptySubsequences: false)
        var token: String?
        for pair in pairs {
            guard let separator = pair.firstIndex(of: "=") else {
                throw PairingURLValidationError.invalidFormat
            }
            let rawName = String(pair[..<separator])
            let rawValue = String(pair[pair.index(after: separator)...])
            try PairingPercentCoding.assertRawQueryAtom(rawName)
            try PairingPercentCoding.assertRawQueryAtom(rawValue)
            let name = try PairingPercentCoding.decode(rawName)
            let value = try PairingPercentCoding.decode(rawValue)
            guard name == "token", token == nil, !value.isEmpty else {
                throw PairingURLValidationError.invalidFormat
            }
            token = value
        }
        guard let token else {
            throw PairingURLValidationError.invalidFormat
        }
        return token
    }

    private enum CodingKeys: String, CodingKey {
        case id
        case name
        case url
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(UUID.self, forKey: .id)
        name = try container.decode(String.self, forKey: .name)
        url = try container.decode(URL.self, forKey: .url)
        token = ""
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(name, forKey: .name)
        try container.encode(url, forKey: .url)
    }
}

enum PairingURLValidationError: LocalizedError {
    case invalidFormat

    var errorDescription: String? {
        "二维码不是 SayDo 桌面配对地址，请重新扫描"
    }
}

enum PairingLANAddress {
    static func isPrivate(_ host: String) -> Bool {
        isRfc1918IPv4(host) || isUniqueLocalIPv6(host)
    }

    private static func isRfc1918IPv4(_ host: String) -> Bool {
        let parts = host.split(separator: ".", omittingEmptySubsequences: false)
        guard parts.count == 4 else { return false }
        var octets: [Int] = []
        for part in parts {
            guard !part.isEmpty, !(part.count > 1 && part.first == "0"),
                  part.allSatisfy(\.isNumber),
                  let value = Int(part), (0...255).contains(value) else {
                return false
            }
            octets.append(value)
        }
        if octets[0] == 10 { return true }
        if octets[0] == 192 && octets[1] == 168 { return true }
        if octets[0] == 172 && (16...31).contains(octets[1]) { return true }
        return false
    }

    private static func isUniqueLocalIPv6(_ host: String) -> Bool {
        let value = host.hasPrefix("[") && host.hasSuffix("]")
            ? String(host.dropFirst().dropLast())
            : host
        guard isIPv6(value) else { return false }
        guard let end = value.firstIndex(of: ":") else { return false }
        let first = value[..<end]
        guard let parsed = Int(first, radix: 16) else { return false }
        return (0xfc00...0xfdff).contains(parsed)
    }

    private static func isIPv6(_ host: String) -> Bool {
        guard host.contains(":"), !host.contains(".") else { return false }
        guard host.unicodeScalars.allSatisfy({ $0.isASCII && (isHex($0) || $0 == ":") }) else {
            return false
        }
        if let compression = host.range(of: "::") {
            if host.range(of: "::", options: .backwards) != compression {
                return false
            }
            let left = String(host[..<compression.lowerBound])
            let right = String(host[compression.upperBound...])
            // Default split drops empty segments, so `fd12::1:` would look like `fd12::1`.
            let leftParts = left.isEmpty ? [] : left.split(separator: ":", omittingEmptySubsequences: false)
            let rightParts = right.isEmpty ? [] : right.split(separator: ":", omittingEmptySubsequences: false)
            return leftParts.count + rightParts.count < 8 &&
                leftParts.allSatisfy(isHextet(_:)) &&
                rightParts.allSatisfy(isHextet(_:))
        }
        let parts = host.split(separator: ":", omittingEmptySubsequences: false)
        return parts.count == 8 && parts.allSatisfy(isHextet(_:))
    }

    private static func isHextet(_ part: Substring) -> Bool {
        (1...4).contains(part.count) && part.unicodeScalars.allSatisfy(isHex)
    }

    private static func isHex(_ scalar: Unicode.Scalar) -> Bool {
        CharacterSet(charactersIn: "0123456789abcdefABCDEF").contains(scalar)
    }
}

enum PairingPercentCoding {
    static func asciiTrim(_ value: String) -> String {
        // Trim Unicode scalars, not Character graphemes: CRLF is one Character but two scalars.
        let scalars = value.unicodeScalars
        var start = scalars.startIndex
        var end = scalars.endIndex
        while start < end, isAsciiWs(scalars[start].value) {
            start = scalars.index(after: start)
        }
        while end > start {
            let prev = scalars.index(before: end)
            if !isAsciiWs(scalars[prev].value) { break }
            end = prev
        }
        return String(String.UnicodeScalarView(scalars[start..<end]))
    }

    static func assertRawQueryAtom(_ raw: String) throws {
        guard !raw.isEmpty else { throw PairingURLValidationError.invalidFormat }
        var index = raw.startIndex
        while index < raw.endIndex {
            if raw[index] == "%" {
                guard let hexEnd = raw.index(index, offsetBy: 3, limitedBy: raw.endIndex) else {
                    throw PairingURLValidationError.invalidFormat
                }
                let hex = raw[raw.index(after: index)..<hexEnd]
                guard hex.count == 2,
                      hex.unicodeScalars.allSatisfy({ CharacterSet(charactersIn: "0123456789abcdefABCDEF").contains($0) }) else {
                    throw PairingURLValidationError.invalidFormat
                }
                index = hexEnd
                continue
            }
            let code = raw[index].unicodeScalars.first?.value ?? 0
            guard isUnreserved(code) else { throw PairingURLValidationError.invalidFormat }
            index = raw.index(after: index)
        }
    }

    static func encode(_ value: String) -> String {
        var output = ""
        for byte in value.utf8 {
            if isUnreserved(UInt32(byte)) {
                output.append(Character(Unicode.Scalar(byte)))
            } else {
                output.append(String(format: "%%%02X", byte))
            }
        }
        return output
    }

    static func decode(_ value: String) throws -> String {
        var bytes: [UInt8] = []
        var index = value.startIndex
        while index < value.endIndex {
            if value[index] == "%" {
                guard let hexEnd = value.index(index, offsetBy: 3, limitedBy: value.endIndex) else {
                    throw PairingURLValidationError.invalidFormat
                }
                let hex = value[value.index(after: index)..<hexEnd]
                guard hex.count == 2,
                      hex.unicodeScalars.allSatisfy({ CharacterSet(charactersIn: "0123456789abcdefABCDEF").contains($0) }),
                      let parsed = UInt8(hex, radix: 16) else {
                    throw PairingURLValidationError.invalidFormat
                }
                bytes.append(parsed)
                index = hexEnd
                continue
            }
            let code = value[index].unicodeScalars.first?.value ?? 0
            guard isUnreserved(code), let byte = UInt8(exactly: code) else {
                throw PairingURLValidationError.invalidFormat
            }
            bytes.append(byte)
            index = value.index(after: index)
        }
        guard let decoded = String(data: Data(bytes), encoding: .utf8) else {
            throw PairingURLValidationError.invalidFormat
        }
        return decoded
    }

    private static func isAsciiWs(_ code: UInt32) -> Bool {
        code == 0x20 || code == 0x09 || code == 0x0a || code == 0x0d
    }

    private static func isUnreserved(_ code: UInt32) -> Bool {
        (0x41...0x5a).contains(code) || (0x61...0x7a).contains(code) || (0x30...0x39).contains(code) ||
            code == 0x2d || code == 0x2e || code == 0x5f || code == 0x7e
    }
}
