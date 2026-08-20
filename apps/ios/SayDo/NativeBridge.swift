import Foundation
import Combine
import WebKit

struct NativeFocus: Identifiable, Equatable {
    let id: String
    let title: String
    let updatedAt: String
}

enum NativeReplyOrigin: String {
    case assistantReply = "assistant_reply"
    case system
    case confirmation
    case onboarding
}

struct NativeReply: Equatable {
    let sessionId: String
    let turnId: String
    let sentenceId: String
    let text: String
    let origin: NativeReplyOrigin
}

struct NativeTranscriptSubmission {
    let requestId: String
    let captureId: String
    let text: String
    let focus: NativeFocus?
    let action: String

    var javaScriptArguments: [String: Any] {
        var input: [String: Any] = [
            "requestId": requestId,
            "captureId": captureId,
            "text": text,
            "action": action,
        ]
        if let focus {
            input["focusId"] = focus.id
            input["focusTitle"] = FocusTitleSanitizer.sanitize(focus.title)
        }
        return ["input": input]
    }
}

enum NativeSubmissionStatus: String {
    case queuedToSocket = "queued_to_socket"
    case drafted
    case rejected
}

struct NativeSubmissionResult {
    let status: NativeSubmissionStatus
    let reason: String?
}

enum NativeDaemonStatus: String {
    case connecting
    case online
    case offline
}

struct NativeBridgeOrigin: Equatable {
    let scheme: String
    let host: String
    let port: Int

    init?(url: URL) {
        guard let scheme = url.scheme?.lowercased(), let host = url.host?.lowercased() else { return nil }
        self.scheme = scheme
        self.host = host
        port = url.port ?? Self.defaultPort(for: scheme)
    }

    func matches(scheme candidateScheme: String, host candidateHost: String, port candidatePort: Int) -> Bool {
        scheme == candidateScheme.lowercased()
            && host == candidateHost.lowercased()
            && port == candidatePort
    }

    func matches(url: URL?) -> Bool {
        guard let url, let candidate = NativeBridgeOrigin(url: url) else { return false }
        return candidate == self
    }

    private static func defaultPort(for scheme: String) -> Int {
        switch scheme {
        case "http": 80
        case "https": 443
        default: -1
        }
    }
}

@MainActor
final class NativeBridgeController: NSObject, ObservableObject, WKScriptMessageHandler {
    nonisolated static let version = 1
    nonisolated static let handlerName = "saydoNative"

    @Published private(set) var pageReady = false
    @Published private(set) var focuses: [NativeFocus] = []
    @Published private(set) var daemonStatus: NativeDaemonStatus = .connecting

    var onReply: ((NativeReply) -> Void)?
    private weak var webView: WKWebView?
    private var pageGeneration = 0
    private var activeSessionId: String?
    private var expectedOrigin: NativeBridgeOrigin?
    private var expectedPageNonce: String?

    func attach(webView: WKWebView) {
        self.webView = webView
        invalidatePage()
    }

    func bind(profileURL: URL) {
        let origin = NativeBridgeOrigin(url: profileURL)
        guard expectedOrigin != origin else { return }
        expectedOrigin = origin
        invalidatePage()
    }

    func beginNavigation(pageNonce: String) {
        expectedPageNonce = pageNonce
        invalidatePage(keepingNonce: true)
    }

    func invalidatePage(keepingNonce: Bool = false) {
        pageGeneration += 1
        pageReady = false
        activeSessionId = nil
        focuses = []
        daemonStatus = .connecting
        if !keepingNonce {
            expectedPageNonce = nil
        }
    }

    func allowsProfileURL(_ url: URL?) -> Bool {
        expectedOrigin?.matches(url: url) == true
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == Self.handlerName,
              message.frameInfo.isMainFrame,
              let webView,
              message.webView === webView,
              let expectedOrigin,
              expectedOrigin.matches(
                scheme: message.frameInfo.securityOrigin.protocol,
                host: message.frameInfo.securityOrigin.host,
                port: message.frameInfo.securityOrigin.port
              ) else {
            return
        }
        guard let body = message.body as? [String: Any],
              (body["version"] as? NSNumber)?.intValue == Self.version,
              body["pageNonce"] as? String == expectedPageNonce,
              let type = body["type"] as? String else {
            return
        }
        switch type {
        case "page-ready":
            guard let sessionId = body["sessionId"] as? String, !sessionId.isEmpty else { return }
            activeSessionId = sessionId
            pageReady = true
        case "focuses":
            guard pageReady else { return }
            focuses = parseFocuses(body["focuses"])
        case "status":
            guard pageReady else { return }
            guard let raw = body["status"] as? String, let status = NativeDaemonStatus(rawValue: raw) else { return }
            daemonStatus = status
        case "reply":
            guard pageReady else { return }
            guard let reply = parseReply(body["reply"]), reply.sessionId == activeSessionId else { return }
            onReply?(reply)
        default:
            return
        }
    }

    func submit(_ submission: NativeTranscriptSubmission) async -> NativeSubmissionResult {
        guard pageReady, let webView, allowsProfileURL(webView.url) else {
            return NativeSubmissionResult(status: .rejected, reason: "bridge_inactive")
        }
        let expectedPageGeneration = pageGeneration
        let body = """
        const bridge = window.SayDoNativeBridge;
        if (!bridge || bridge.version !== 1) {
          return { status: "rejected", reason: "bridge_inactive" };
        }
        return await bridge.submitNativeTranscript(input);
        """
        do {
            let raw = try await webView.callAsyncJavaScript(
                body,
                arguments: submission.javaScriptArguments,
                in: nil,
                contentWorld: .page
            )
            guard pageReady,
                  pageGeneration == expectedPageGeneration,
                  self.webView === webView,
                  allowsProfileURL(webView.url) else {
                return NativeSubmissionResult(status: .rejected, reason: "bridge_inactive")
            }
            guard let result = raw as? [String: Any],
                  let statusRaw = result["status"] as? String,
                  let status = NativeSubmissionStatus(rawValue: statusRaw),
                  result["requestId"] as? String == submission.requestId,
                  result["captureId"] as? String == submission.captureId else {
                return NativeSubmissionResult(status: .rejected, reason: "invalid_bridge_response")
            }
            return NativeSubmissionResult(status: status, reason: result["reason"] as? String)
        } catch {
            return NativeSubmissionResult(status: .rejected, reason: "bridge_call_failed")
        }
    }

    private func parseFocuses(_ raw: Any?) -> [NativeFocus] {
        guard let rows = raw as? [[String: Any]] else { return [] }
        return rows.prefix(3).compactMap { row in
            guard let id = row["id"] as? String,
                  let title = row["title"] as? String,
                  let updatedAt = row["updatedAt"] as? String else {
                return nil
            }
            return NativeFocus(id: id, title: FocusTitleSanitizer.sanitize(title), updatedAt: updatedAt)
        }
    }

    private func parseReply(_ raw: Any?) -> NativeReply? {
        guard let value = raw as? [String: Any],
              let sessionId = value["sessionId"] as? String,
              let turnId = value["turnId"] as? String,
              let sentenceId = value["sentenceId"] as? String,
              let text = value["text"] as? String,
              let originRaw = value["origin"] as? String,
              let origin = NativeReplyOrigin(rawValue: originRaw) else {
            return nil
        }
        return NativeReply(
            sessionId: sessionId,
            turnId: turnId,
            sentenceId: sentenceId,
            text: text,
            origin: origin
        )
    }
}
