import Foundation
import Security

@MainActor
final class ConnectionStore: ObservableObject {
    @Published private(set) var profiles: [DesktopProfile]
    @Published private(set) var currentId: UUID?

    private let defaults: UserDefaults
    private let profilesKey = "saydo.desktopProfiles"
    private let currentIdKey = "saydo.currentDesktopId"

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults

        let storedProfiles = defaults.data(forKey: profilesKey)
            .flatMap { try? JSONDecoder().decode([DesktopProfile].self, from: $0) }
            ?? []
        profiles = storedProfiles.map { profile in
            var hydrated = profile
            hydrated.token = KeychainTokenStore.read(profileId: profile.id) ?? ""
            return hydrated
        }

        let storedCurrentId = defaults.string(forKey: currentIdKey).flatMap(UUID.init(uuidString:))
        if let storedCurrentId, profiles.contains(where: { $0.id == storedCurrentId }) {
            currentId = storedCurrentId
        } else {
            currentId = profiles.first?.id
        }
    }

    var currentProfile: DesktopProfile? {
        guard let currentId else { return nil }
        return profiles.first { $0.id == currentId }
    }

    func add(_ profile: DesktopProfile) throws {
        try KeychainTokenStore.write(profile.token, profileId: profile.id)
        profiles.append(profile)
        currentId = profile.id
        persist()
    }

    func select(_ id: UUID) {
        guard profiles.contains(where: { $0.id == id }) else { return }
        currentId = id
        persist()
    }

    func delete(_ id: UUID) {
        KeychainTokenStore.delete(profileId: id)
        profiles.removeAll { $0.id == id }
        if currentId == id {
            currentId = profiles.first?.id
        }
        persist()
    }

    private func persist() {
        if let data = try? JSONEncoder().encode(profiles) {
            defaults.set(data, forKey: profilesKey)
        }

        if let currentId {
            defaults.set(currentId.uuidString, forKey: currentIdKey)
        } else {
            defaults.removeObject(forKey: currentIdKey)
        }
    }
}

private enum KeychainTokenStore {
    private static let service = "com.octoooo.saydo.desktop-token"

    static func read(profileId: UUID) -> String? {
        let query: [CFString: Any] = [
            kSecClass: kSecClassGenericPassword,
            kSecAttrService: service,
            kSecAttrAccount: profileId.uuidString,
            kSecMatchLimit: kSecMatchLimitOne,
            kSecReturnData: true,
        ]
        var result: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data else {
            return nil
        }
        return String(data: data, encoding: .utf8)
    }

    static func write(_ token: String, profileId: UUID) throws {
        let query: [CFString: Any] = [
            kSecClass: kSecClassGenericPassword,
            kSecAttrService: service,
            kSecAttrAccount: profileId.uuidString,
        ]
        let attributes: [CFString: Any] = [
            kSecValueData: Data(token.utf8),
            kSecAttrAccessible: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
        ]

        let updateStatus = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
        if updateStatus == errSecSuccess {
            return
        }
        guard updateStatus == errSecItemNotFound else {
            throw KeychainError(status: updateStatus)
        }

        var item = query
        item.merge(attributes) { _, newValue in newValue }
        let addStatus = SecItemAdd(item as CFDictionary, nil)
        guard addStatus == errSecSuccess else {
            throw KeychainError(status: addStatus)
        }
    }

    static func delete(profileId: UUID) {
        let query: [CFString: Any] = [
            kSecClass: kSecClassGenericPassword,
            kSecAttrService: service,
            kSecAttrAccount: profileId.uuidString,
        ]
        SecItemDelete(query as CFDictionary)
    }
}

private struct KeychainError: LocalizedError {
    let status: OSStatus

    var errorDescription: String? {
        "无法安全保存桌面凭据（\(status)）"
    }
}
