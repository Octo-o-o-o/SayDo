import Foundation

// Generated from scripts/pairing-url-corpus.json. Do not edit.

struct PairingCorpusCase {
    let id: String
    let accept: Bool
    let prefix: String
    let hostParts: [String]
    let hostSep: String
    let bracketHost: Bool
    let port: String
    let pathQuery: String
    let suffix: String
    let token: String?
    let expectPort: String?

    var input: String {
        let host = hostParts.joined(separator: hostSep)
        let authority = bracketHost ? "[\(host)]" : host
        return prefix + authority + ":" + port + pathQuery + suffix
    }

    var expectedName: String? {
        guard let expectPort, let parsed = Int(expectPort) else { return nil }
        return hostParts.joined(separator: hostSep) + ":" + String(parsed)
    }
}

enum PairingUrlCorpus {
    static let cases: [PairingCorpusCase] = [
        PairingCorpusCase(
            id: "accept-ipv4",
            accept: true,
            prefix: "http://",
            hostParts: ["192", "168", "1", "8"],
            hostSep: ".",
            bracketHost: false,
            port: "47100",
            pathQuery: "/?token=abc",
            suffix: "",
            token: "abc",
            expectPort: "47100"
        ),
        PairingCorpusCase(
            id: "accept-ascii-trim",
            accept: true,
            prefix: "\n\t http://",
            hostParts: ["192", "168", "1", "8"],
            hostSep: ".",
            bracketHost: false,
            port: "47100",
            pathQuery: "/?token=abc",
            suffix: " \r\n",
            token: "abc",
            expectPort: "47100"
        ),
        PairingCorpusCase(
            id: "accept-trim-cr",
            accept: true,
            prefix: "\rhttp://",
            hostParts: ["192", "168", "1", "8"],
            hostSep: ".",
            bracketHost: false,
            port: "47100",
            pathQuery: "/?token=abc",
            suffix: "\r",
            token: "abc",
            expectPort: "47100"
        ),
        PairingCorpusCase(
            id: "accept-trim-lf",
            accept: true,
            prefix: "\nhttp://",
            hostParts: ["192", "168", "1", "8"],
            hostSep: ".",
            bracketHost: false,
            port: "47100",
            pathQuery: "/?token=abc",
            suffix: "\n",
            token: "abc",
            expectPort: "47100"
        ),
        PairingCorpusCase(
            id: "accept-trim-crlf",
            accept: true,
            prefix: "\r\nhttp://",
            hostParts: ["192", "168", "1", "8"],
            hostSep: ".",
            bracketHost: false,
            port: "47100",
            pathQuery: "/?token=abc",
            suffix: "\r\n",
            token: "abc",
            expectPort: "47100"
        ),
        PairingCorpusCase(
            id: "accept-trim-mixed",
            accept: true,
            prefix: "\r\n\t http://",
            hostParts: ["192", "168", "1", "8"],
            hostSep: ".",
            bracketHost: false,
            port: "47100",
            pathQuery: "/?token=abc",
            suffix: " \t\r\n",
            token: "abc",
            expectPort: "47100"
        ),
        PairingCorpusCase(
            id: "accept-leading-zero-port",
            accept: true,
            prefix: "http://",
            hostParts: ["192", "168", "1", "8"],
            hostSep: ".",
            bracketHost: false,
            port: "047100",
            pathQuery: "/?token=abc",
            suffix: "",
            token: "abc",
            expectPort: "47100"
        ),
        PairingCorpusCase(
            id: "accept-ula",
            accept: true,
            prefix: "http://",
            hostParts: ["fd12", "3456", "789a", "1", "", "1"],
            hostSep: ":",
            bracketHost: true,
            port: "47100",
            pathQuery: "/?token=abc",
            suffix: "",
            token: "abc",
            expectPort: "47100"
        ),
        PairingCorpusCase(
            id: "accept-percent-reserved",
            accept: true,
            prefix: "http://",
            hostParts: ["192", "168", "1", "8"],
            hostSep: ".",
            bracketHost: false,
            port: "47100",
            pathQuery: "/?token=a%2Fb%20c%2Bd",
            suffix: "",
            token: "a/b c+d",
            expectPort: "47100"
        ),
        PairingCorpusCase(
            id: "accept-percent-bmp",
            accept: true,
            prefix: "http://",
            hostParts: ["192", "168", "1", "8"],
            hostSep: ".",
            bracketHost: false,
            port: "47100",
            pathQuery: "/?token=%E4%BD%A0%E5%A5%BD",
            suffix: "",
            token: "\u{4F60}\u{597D}",
            expectPort: "47100"
        ),
        PairingCorpusCase(
            id: "accept-percent-non-bmp",
            accept: true,
            prefix: "http://",
            hostParts: ["192", "168", "1", "8"],
            hostSep: ".",
            bracketHost: false,
            port: "47100",
            pathQuery: "/?token=%F0%90%80%80",
            suffix: "",
            token: "\u{10000}",
            expectPort: "47100"
        ),
        PairingCorpusCase(
            id: "reject-bom",
            accept: false,
            prefix: "\u{FEFF}http://",
            hostParts: ["192", "168", "1", "8"],
            hostSep: ".",
            bracketHost: false,
            port: "47100",
            pathQuery: "/?token=abc",
            suffix: "",
            token: nil,
            expectPort: nil
        ),
        PairingCorpusCase(
            id: "reject-nbsp",
            accept: false,
            prefix: "\u{A0}http://",
            hostParts: ["192", "168", "1", "8"],
            hostSep: ".",
            bracketHost: false,
            port: "47100",
            pathQuery: "/?token=abc",
            suffix: "",
            token: nil,
            expectPort: nil
        ),
        PairingCorpusCase(
            id: "reject-raw-space",
            accept: false,
            prefix: "http://",
            hostParts: ["192", "168", "1", "8"],
            hostSep: ".",
            bracketHost: false,
            port: "47100",
            pathQuery: "/?token=abc def",
            suffix: "",
            token: nil,
            expectPort: nil
        ),
        PairingCorpusCase(
            id: "reject-raw-tab",
            accept: false,
            prefix: "http://",
            hostParts: ["192", "168", "1", "8"],
            hostSep: ".",
            bracketHost: false,
            port: "47100",
            pathQuery: "/?token=abc\tdef",
            suffix: "",
            token: nil,
            expectPort: nil
        ),
        PairingCorpusCase(
            id: "reject-raw-nul",
            accept: false,
            prefix: "http://",
            hostParts: ["192", "168", "1", "8"],
            hostSep: ".",
            bracketHost: false,
            port: "47100",
            pathQuery: "/?token=abc\u{0}",
            suffix: "",
            token: nil,
            expectPort: nil
        ),
        PairingCorpusCase(
            id: "reject-raw-at",
            accept: false,
            prefix: "http://",
            hostParts: ["192", "168", "1", "8"],
            hostSep: ".",
            bracketHost: false,
            port: "47100",
            pathQuery: "/?token=abc@x",
            suffix: "",
            token: nil,
            expectPort: nil
        ),
        PairingCorpusCase(
            id: "reject-raw-brackets",
            accept: false,
            prefix: "http://",
            hostParts: ["192", "168", "1", "8"],
            hostSep: ".",
            bracketHost: false,
            port: "47100",
            pathQuery: "/?token=abc[x]",
            suffix: "",
            token: nil,
            expectPort: nil
        ),
        PairingCorpusCase(
            id: "reject-raw-non-bmp",
            accept: false,
            prefix: "http://",
            hostParts: ["192", "168", "1", "8"],
            hostSep: ".",
            bracketHost: false,
            port: "47100",
            pathQuery: "/?token=abc\u{10000}",
            suffix: "",
            token: nil,
            expectPort: nil
        ),
        PairingCorpusCase(
            id: "reject-bad-percent-zz",
            accept: false,
            prefix: "http://",
            hostParts: ["192", "168", "1", "8"],
            hostSep: ".",
            bracketHost: false,
            port: "47100",
            pathQuery: "/?token=%zz",
            suffix: "",
            token: nil,
            expectPort: nil
        ),
        PairingCorpusCase(
            id: "reject-truncated-percent",
            accept: false,
            prefix: "http://",
            hostParts: ["192", "168", "1", "8"],
            hostSep: ".",
            bracketHost: false,
            port: "47100",
            pathQuery: "/?token=%2",
            suffix: "",
            token: nil,
            expectPort: nil
        ),
        PairingCorpusCase(
            id: "reject-overlong",
            accept: false,
            prefix: "http://",
            hostParts: ["192", "168", "1", "8"],
            hostSep: ".",
            bracketHost: false,
            port: "47100",
            pathQuery: "/?token=%C0%AF",
            suffix: "",
            token: nil,
            expectPort: nil
        ),
        PairingCorpusCase(
            id: "reject-surrogate-utf8",
            accept: false,
            prefix: "http://",
            hostParts: ["192", "168", "1", "8"],
            hostSep: ".",
            bracketHost: false,
            port: "47100",
            pathQuery: "/?token=%ED%A0%80",
            suffix: "",
            token: nil,
            expectPort: nil
        ),
        PairingCorpusCase(
            id: "reject-truncated-utf8",
            accept: false,
            prefix: "http://",
            hostParts: ["192", "168", "1", "8"],
            hostSep: ".",
            bracketHost: false,
            port: "47100",
            pathQuery: "/?token=%E4%BD",
            suffix: "",
            token: nil,
            expectPort: nil
        ),
        PairingCorpusCase(
            id: "reject-empty-fragment",
            accept: false,
            prefix: "http://",
            hostParts: ["192", "168", "1", "8"],
            hostSep: ".",
            bracketHost: false,
            port: "47100",
            pathQuery: "/?token=abc#",
            suffix: "",
            token: nil,
            expectPort: nil
        ),
        PairingCorpusCase(
            id: "reject-userinfo",
            accept: false,
            prefix: "http://user@",
            hostParts: ["192", "168", "1", "8"],
            hostSep: ".",
            bracketHost: false,
            port: "47100",
            pathQuery: "/?token=abc",
            suffix: "",
            token: nil,
            expectPort: nil
        ),
        PairingCorpusCase(
            id: "reject-duplicate-token",
            accept: false,
            prefix: "http://",
            hostParts: ["192", "168", "1", "8"],
            hostSep: ".",
            bracketHost: false,
            port: "47100",
            pathQuery: "/?token=one&token=two",
            suffix: "",
            token: nil,
            expectPort: nil
        ),
        PairingCorpusCase(
            id: "reject-fullwidth-digit-authority",
            accept: false,
            prefix: "http://",
            hostParts: ["\u{FF11}\u{FF19}\u{FF12}", "\u{FF11}\u{FF16}\u{FF18}", "\u{FF11}", "\u{FF18}"],
            hostSep: ".",
            bracketHost: false,
            port: "47100",
            pathQuery: "/?token=abc",
            suffix: "",
            token: nil,
            expectPort: nil
        ),
        PairingCorpusCase(
            id: "reject-fullwidth-dot-authority",
            accept: false,
            prefix: "http://",
            hostParts: ["192", "168", "1", "8"],
            hostSep: "\u{FF0E}",
            bracketHost: false,
            port: "47100",
            pathQuery: "/?token=abc",
            suffix: "",
            token: nil,
            expectPort: nil
        ),
        PairingCorpusCase(
            id: "reject-ideographic-dot-authority",
            accept: false,
            prefix: "http://",
            hostParts: ["192", "168", "1", "8"],
            hostSep: "\u{3002}",
            bracketHost: false,
            port: "47100",
            pathQuery: "/?token=abc",
            suffix: "",
            token: nil,
            expectPort: nil
        ),
        PairingCorpusCase(
            id: "reject-circled-digit-authority",
            accept: false,
            prefix: "http://",
            hostParts: ["\u{2460}\u{2468}\u{2461}", "\u{2460}\u{2465}\u{2467}", "\u{2460}", "\u{2467}"],
            hostSep: ".",
            bracketHost: false,
            port: "47100",
            pathQuery: "/?token=abc",
            suffix: "",
            token: nil,
            expectPort: nil
        ),
        PairingCorpusCase(
            id: "reject-zwsp-authority",
            accept: false,
            prefix: "http://",
            hostParts: ["192", "\u{200B}168", "1", "8"],
            hostSep: ".",
            bracketHost: false,
            port: "47100",
            pathQuery: "/?token=abc",
            suffix: "",
            token: nil,
            expectPort: nil
        ),
        PairingCorpusCase(
            id: "accept-ula-compressed-short",
            accept: true,
            prefix: "http://",
            hostParts: ["fd12", "", "1"],
            hostSep: ":",
            bracketHost: true,
            port: "47100",
            pathQuery: "/?token=abc",
            suffix: "",
            token: "abc",
            expectPort: "47100"
        ),
        PairingCorpusCase(
            id: "reject-ula-trailing-single-colon",
            accept: false,
            prefix: "http://",
            hostParts: ["fd12", "", "1", ""],
            hostSep: ":",
            bracketHost: true,
            port: "47100",
            pathQuery: "/?token=abc",
            suffix: "",
            token: nil,
            expectPort: nil
        ),
        PairingCorpusCase(
            id: "reject-ula-leading-single-colon",
            accept: false,
            prefix: "http://",
            hostParts: ["", "fd12", "", "1"],
            hostSep: ":",
            bracketHost: true,
            port: "47100",
            pathQuery: "/?token=abc",
            suffix: "",
            token: nil,
            expectPort: nil
        ),
        PairingCorpusCase(
            id: "reject-ula-triple-colon",
            accept: false,
            prefix: "http://",
            hostParts: ["fd12", "", "", "1"],
            hostSep: ":",
            bracketHost: true,
            port: "47100",
            pathQuery: "/?token=abc",
            suffix: "",
            token: nil,
            expectPort: nil
        )
    ]
}
