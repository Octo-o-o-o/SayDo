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

    init(pairingURL: URL) throws {
        guard var components = URLComponents(url: pairingURL, resolvingAgainstBaseURL: false),
              components.scheme?.lowercased() == "http",
              let host = components.host,
              !host.isEmpty,
              components.user == nil,
              components.password == nil,
              let port = components.port,
              let token = components.queryItems?.first(where: { $0.name == "token" })?.value,
              !token.isEmpty else {
            throw PairingURLValidationError.invalidFormat
        }

        components.queryItems = components.queryItems?.filter { $0.name != "token" }
        if components.queryItems?.isEmpty == true {
            components.queryItems = nil
        }
        components.fragment = nil

        guard let baseURL = components.url else {
            throw PairingURLValidationError.invalidFormat
        }

        self.init(name: "\(host):\(port)", url: baseURL, token: token)
    }

    var authenticatedURL: URL {
        guard var components = URLComponents(url: url, resolvingAgainstBaseURL: false) else {
            return url
        }
        var queryItems = components.queryItems ?? []
        queryItems.removeAll { $0.name == "token" }
        queryItems.append(URLQueryItem(name: "token", value: token))
        components.queryItems = queryItems
        return components.url ?? url
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
