import XCTest
@testable import SayDo

final class DesktopProfileTests: XCTestCase {
    func testAcceptsPrivateIPv4() throws {
        for host in ["10.0.0.1", "172.16.0.1", "172.31.255.1", "192.168.1.8"] {
            let profile = try DesktopProfile(pairingURL: url("http://\(host):47100/?token=abc"))
            XCTAssertEqual(profile.token, "abc")
            XCTAssertEqual(profile.name, "\(host):47100")
        }
    }

    func testAcceptsUniqueLocalIPv6() throws {
        let profile = try DesktopProfile(pairingURL: url("http://[fd12:3456:789a:1::1]:47100/?token=abc"))
        XCTAssertEqual(profile.token, "abc")
        XCTAssertEqual(profile.name, "fd12:3456:789a:1::1:47100")
        XCTAssertFalse(profile.name.contains("["))
        XCTAssertFalse(profile.name.contains("]"))
        XCTAssertEqual(profile.url.absoluteString, "http://[fd12:3456:789a:1::1]:47100/")
    }

    func testRejectsMalformedCompressedIpv6() throws {
        let rejected = [
            "http://[fd12::1:]:47100/?token=abc",
            "http://[:fd12::1]:47100/?token=abc",
            "http://[fd12:::1]:47100/?token=abc"
        ]
        for value in rejected {
            XCTAssertThrowsError(try DesktopProfile(pairingURLString: value), value)
            if let parsed = URL(string: value) {
                XCTAssertThrowsError(try DesktopProfile(pairingURL: parsed), value)
            }
        }
        let accepted = try DesktopProfile(pairingURLString: "http://[fd12::1]:47100/?token=abc")
        XCTAssertEqual(accepted.token, "abc")
        XCTAssertEqual(accepted.name, "fd12::1:47100")
    }

    func testRejectsUnbracketedAndMalformedIPv6Authority() {
        let rejected = [
            "http://fd00::1:47100/?token=abc",
            "http://fd12:3456:789a:1::1:47100/?token=abc",
            "http://[fd12:3456:789a:1::1:47100/?token=abc",
            "http://fd12:3456:789a:1::1]:47100/?token=abc",
            "http://[[fd12:3456:789a:1::1]]:47100/?token=abc"
        ]
        for value in rejected {
            assertRejectsPairing(value)
        }
    }

    func testQueryAndPathBracketsDoNotCountAsAuthorityBrackets() {
        let rejected = [
            "http://fd12:3456:789a:1::1:47100/?token=abc[x]",
            "http://fd12:3456:789a:1::1:47100/?token=abc%5Bx%5D",
            "http://fd00::1:47100/?token=%5Babc%5D",
            "http://fd12:3456:789a:1::1:47100/[/]?token=abc",
            "http://fd12:3456:789a:1::1:47100/%5Bx%5D?token=abc"
        ]
        for value in rejected {
            assertRejectsPairing(value)
        }
    }

    func testSharedCorpusAcceptAndReject() throws {
        XCTAssertFalse(PairingUrlCorpus.cases.isEmpty)
        for item in PairingUrlCorpus.cases {
            if item.accept {
                do {
                    let profile = try DesktopProfile(pairingURLString: item.input)
                    XCTAssertEqual(profile.token, item.token, item.id)
                    XCTAssertEqual(profile.name, item.expectedName, item.id)
                } catch {
                    XCTFail("\(item.id) threw \(error)")
                }
            } else {
                XCTAssertThrowsError(
                    try DesktopProfile(pairingURLString: item.input),
                    item.id
                )
            }
        }
    }

    func testStringEntryTrimsWhitespaceAndNewlines() throws {
        let cr = try DesktopProfile(pairingURLString: "\rhttp://192.168.1.8:47100/?token=abc\r")
        XCTAssertEqual(cr.token, "abc")
        let lf = try DesktopProfile(pairingURLString: "\nhttp://192.168.1.8:47100/?token=abc\n")
        XCTAssertEqual(lf.token, "abc")
        let crlf = try DesktopProfile(pairingURLString: "\r\nhttp://192.168.1.8:47100/?token=abc\r\n")
        XCTAssertEqual(crlf.token, "abc")
        let mixed = try DesktopProfile(pairingURLString: "\n\t http://192.168.1.8:47100/?token=abc \r\n")
        XCTAssertEqual(mixed.token, "abc")
        XCTAssertEqual(mixed.name, "192.168.1.8:47100")
        XCTAssertEqual(mixed.url.absoluteString, "http://192.168.1.8:47100/")
        XCTAssertEqual(
            PairingPercentCoding.asciiTrim("\u{FEFF}http://example"),
            "\u{FEFF}http://example"
        )
        XCTAssertEqual(
            PairingPercentCoding.asciiTrim("\u{00A0}http://example"),
            "\u{00A0}http://example"
        )
        assertRejectsPairing("\u{FEFF}http://192.168.1.8:47100/?token=abc")
        assertRejectsPairing("\u{00A0}http://192.168.1.8:47100/?token=abc")
    }

    func testAcceptsLeadingZeroPortAndNormalizes() throws {
        let profile = try DesktopProfile(pairingURLString: "http://192.168.1.8:047100/?token=abc")
        XCTAssertEqual(profile.name, "192.168.1.8:47100")
        XCTAssertEqual(profile.url.absoluteString, "http://192.168.1.8:47100/")
    }

    func testRejectsEmptyFragmentZeroOverflowPortAndOversizedOctet() {
        let rejected = [
            "http://192.168.1.8:47100/?token=abc#",
            "http://192.168.1.8:47100/?token=abc#frag",
            "http://192.168.1.8:00000/?token=abc",
            "http://192.168.1.8:0/?token=abc",
            "http://192.168.1.8:65536/?token=abc",
            "http://192.168.1.8:99a/?token=abc",
            "http://192.168.1.\(String(repeating: "9", count: 40)):47100/?token=abc"
        ]
        for value in rejected {
            assertRejectsPairing(value)
        }
    }

    func testRejectsMalformedPercentEscapesBeforeURLConstruction() {
        let rejected = [
            "http://192.168.1.8:47100/?token=%zz",
            "http://192.168.1.8:47100/?token=%2",
            "http://192.168.1.8:47100/?token=%",
            "http://192.168.1.8:47100/?token=%0",
            "http://192.168.1.8:47100/?token=ab%",
            "http://192.168.1.8:47100/%zz?token=abc"
        ]
        for value in rejected {
            assertRejectsPairing(value)
        }
    }

    func testAcceptsWellFormedPercentEscapesIncluding25And00() throws {
        let percent = try DesktopProfile(pairingURLString: "http://192.168.1.8:47100/?token=%25")
        XCTAssertEqual(percent.token, "%")
        let nul = try DesktopProfile(pairingURLString: "http://192.168.1.8:47100/?token=%00")
        XCTAssertEqual(nul.token, "\u{0}")
        let utf8 = try DesktopProfile(pairingURLString: "http://192.168.1.8:47100/?token=%E4%BD%A0")
        XCTAssertEqual(utf8.token, "\u{4F60}")
        let ipv6 = try DesktopProfile(pairingURLString: "http://[fd12:3456:789a:1::1]:47100/?token=a%2Fb")
        XCTAssertEqual(ipv6.token, "a/b")
        XCTAssertEqual(ipv6.name, "fd12:3456:789a:1::1:47100")
    }

    func testPercentDecodeConsumesTwoHexDigits() throws {
        XCTAssertEqual(try PairingPercentCoding.decode("%2F"), "/")
        XCTAssertEqual(try PairingPercentCoding.decode("%20"), " ")
        XCTAssertEqual(try PairingPercentCoding.decode("%2B"), "+")
        XCTAssertEqual(try PairingPercentCoding.decode("a%2Fb%20c%2Bd"), "a/b c+d")
        XCTAssertEqual(try PairingPercentCoding.decode("%E4%BD%A0"), "\u{4F60}")
        XCTAssertEqual(try PairingPercentCoding.decode("%F0%90%80%80"), "\u{10000}")
        XCTAssertThrowsError(try PairingPercentCoding.decode("%"))
        XCTAssertThrowsError(try PairingPercentCoding.decode("%2"))
        XCTAssertThrowsError(try PairingPercentCoding.decode("%zz"))
        XCTAssertThrowsError(try PairingPercentCoding.decode("%C0%AF"))
        XCTAssertThrowsError(try PairingPercentCoding.decode("%ED%A0%80"))
        XCTAssertThrowsError(try PairingPercentCoding.decode("%E4%BD"))
        XCTAssertThrowsError(try PairingPercentCoding.decode("%F0%90%80"))
    }

    func testPercentEncodeDecodeToken() throws {
        let profile = try DesktopProfile(pairingURL: url("http://192.168.1.8:47100/?token=a%2Fb%20c%2Bd"))
        XCTAssertEqual(profile.token, "a/b c+d")
        XCTAssertTrue(profile.authenticatedURL.absoluteString.contains("token=a%2Fb%20c%2Bd"))

        let unicode = try DesktopProfile(
            pairingURL: url("http://192.168.1.8:47100/?token=\(PairingPercentCoding.encode("\u{4F60}\u{597D}"))")
        )
        XCTAssertEqual(unicode.token, "\u{4F60}\u{597D}")

        let nonBmp = try DesktopProfile(
            pairingURL: url("http://192.168.1.8:47100/?token=\(PairingPercentCoding.encode("\u{10000}"))")
        )
        XCTAssertEqual(nonBmp.token, "\u{10000}")
    }

    func testRejectsDuplicateTokenUserInfoMissingPortNonHttpExtraAndMalformed() {
        let rejected = [
            "http://192.168.1.8:47100/?token=one&token=two",
            "http://user:pass@192.168.1.8:47100/?token=abc",
            "http://192.168.1.8/?token=abc",
            "https://192.168.1.8:47100/?token=abc",
            "http://192.168.1.8:47100/?token=abc&foo=1",
            "http://192.168.1.8:47100/?token=%zz",
            "http://192.168.1.8:47100/?token=%2",
            "http://8.8.8.8:47100/?token=abc",
            "http://127.0.0.1:47100/?token=abc",
            "http://example.local:47100/?token=abc",
            "http://192.168.1.8:47100/?token=%C0%AF",
            "http://192.168.1.8:47100/?token=%ED%A0%80",
            "http://192.168.1.8:47100/?token=%E4%BD",
            "http://fd00::1:47100/?token=abc",
            "http://fd12:3456:789a:1::1:47100/?token=abc"
        ]
        for value in rejected {
            assertRejectsPairing(value)
        }
    }

    private func assertRejectsPairing(_ value: String, file: StaticString = #filePath, line: UInt = #line) {
        XCTAssertThrowsError(try DesktopProfile(pairingURLString: value), "expected rejection: \(value)", file: file, line: line)
    }

    private func url(_ value: String) -> URL {
        URL(string: value)!
    }
}
