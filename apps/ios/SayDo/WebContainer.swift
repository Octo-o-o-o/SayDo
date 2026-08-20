import SwiftUI
import UIKit
import WebKit

struct WebContainer: UIViewControllerRepresentable {
    let profile: DesktopProfile
    let bridge: NativeBridgeController
    var resumeToken: Int = 0

    func makeUIViewController(context: Context) -> WebViewController {
        let controller = WebViewController(bridge: bridge)
        controller.load(profile: profile)
        return controller
    }

    func updateUIViewController(_ uiViewController: WebViewController, context: Context) {
        uiViewController.load(profile: profile)
        if context.coordinator.lastResumeToken != resumeToken {
            context.coordinator.lastResumeToken = resumeToken
            if resumeToken > 0 {
                uiViewController.notifyNativeResume()
            }
        }
    }

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    final class Coordinator {
        var lastResumeToken: Int = 0
    }
}

final class WebViewController: UIViewController, WKNavigationDelegate, WKUIDelegate {
    private let webView: WKWebView
    private let bridge: NativeBridgeController
    private let errorView = UIView()
    private let errorLabel = UILabel()
    private var loadedProfileSignature: String?
    private var lastRequestedURL: URL?
    private var allowedMediaProtocol: String?
    private var allowedMediaHost: String?
    private var allowedMediaPort: Int?

    /// App 回前台时注入 saydo:native-resume，由 mobile 层转为共享通道立即重连。
    func notifyNativeResume() {
        let source = """
        (function () {
          try { window.dispatchEvent(new Event('saydo:native-resume')); } catch (e) {}
        })();
        """
        webView.evaluateJavaScript(source, completionHandler: nil)
    }

    init(bridge: NativeBridgeController) {
        self.bridge = bridge
        let configuration = WKWebViewConfiguration()
        configuration.allowsInlineMediaPlayback = true
        configuration.mediaTypesRequiringUserActionForPlayback = []
        configuration.websiteDataStore = WKWebsiteDataStore.default()
        configuration.userContentController.add(bridge, contentWorld: .page, name: NativeBridgeController.handlerName)
        webView = WKWebView(frame: .zero, configuration: configuration)
        super.init(nibName: nil, bundle: nil)
        bridge.attach(webView: webView)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    deinit {
        webView.configuration.userContentController.removeScriptMessageHandler(
            forName: NativeBridgeController.handlerName,
            contentWorld: .page
        )
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground

        webView.translatesAutoresizingMaskIntoConstraints = false
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.scrollView.refreshControl = UIRefreshControl()
        webView.scrollView.refreshControl?.addTarget(self, action: #selector(refresh), for: .valueChanged)

        errorView.translatesAutoresizingMaskIntoConstraints = false
        errorView.backgroundColor = .systemBackground
        errorView.isUserInteractionEnabled = false
        errorView.isHidden = true

        errorLabel.translatesAutoresizingMaskIntoConstraints = false
        errorLabel.text = "连不上桌面——确认同一 Wi-Fi，或重扫配对"
        errorLabel.textAlignment = .center
        errorLabel.textColor = .secondaryLabel
        errorLabel.font = .preferredFont(forTextStyle: .body)
        errorLabel.numberOfLines = 0
        errorView.addSubview(errorLabel)

        view.addSubview(webView)
        view.addSubview(errorView)
        NSLayoutConstraint.activate([
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            webView.topAnchor.constraint(equalTo: view.topAnchor),
            webView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            errorView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            errorView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            errorView.topAnchor.constraint(equalTo: view.topAnchor),
            errorView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            errorLabel.leadingAnchor.constraint(equalTo: errorView.layoutMarginsGuide.leadingAnchor),
            errorLabel.trailingAnchor.constraint(equalTo: errorView.layoutMarginsGuide.trailingAnchor),
            errorLabel.centerYAnchor.constraint(equalTo: errorView.centerYAnchor),
        ])
    }

    func load(profile: DesktopProfile) {
        let signature = "\(profile.id.uuidString)|\(profile.url.absoluteString)|\(profile.token)"
        guard signature != loadedProfileSignature else { return }
        bridge.bind(profileURL: profile.url)
        bridge.invalidatePage()
        loadedProfileSignature = signature
        lastRequestedURL = profile.authenticatedURL
        allowedMediaProtocol = profile.url.scheme
        allowedMediaHost = profile.url.host
        allowedMediaPort = profile.url.port
        loadViewIfNeeded()
        errorView.isHidden = true
        webView.load(URLRequest(
            url: profile.authenticatedURL,
            cachePolicy: .reloadRevalidatingCacheData,
            timeoutInterval: 15
        ))
    }

    @objc private func refresh() {
        bridge.invalidatePage()
        if webView.url != nil {
            webView.reload()
        } else if let lastRequestedURL {
            webView.load(URLRequest(url: lastRequestedURL, timeoutInterval: 15))
        } else {
            webView.scrollView.refreshControl?.endRefreshing()
        }
    }

    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation?) {
        bridge.invalidatePage(keepingNonce: true)
        errorView.isHidden = true
    }

    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction,
        decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
    ) {
        guard navigationAction.targetFrame?.isMainFrame == true else {
            decisionHandler(navigationAction.targetFrame == nil ? .cancel : .allow)
            return
        }
        guard bridge.allowsProfileURL(navigationAction.request.url) else {
            bridge.invalidatePage()
            decisionHandler(.cancel)
            return
        }
        if !isSameDocumentNavigation(navigationAction) {
            prepareBridgeForNavigation()
        }
        decisionHandler(.allow)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation?) {
        webView.scrollView.refreshControl?.endRefreshing()
        errorView.isHidden = true
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation?, withError error: Error) {
        showLoadFailure(error)
    }

    func webView(
        _ webView: WKWebView,
        didFailProvisionalNavigation navigation: WKNavigation?,
        withError error: Error
    ) {
        showLoadFailure(error)
    }

    private func showLoadFailure(_ error: Error) {
        webView.scrollView.refreshControl?.endRefreshing()
        guard (error as NSError).code != NSURLErrorCancelled else { return }
        errorView.isHidden = false
    }

    private func prepareBridgeForNavigation() {
        let nonce = UUID().uuidString
        // iPad 宽视口会落桌面版,而原生桥/语音胶囊只在移动壳内接线——强制移动壳保语音全链
        let forceMobileShell = UIDevice.current.userInterfaceIdiom == .pad
            ? "Object.defineProperty(window, '__saydoForceMobileShell', { value: true, configurable: false });"
            : ""
        let source = "Object.defineProperty(window, '__saydoNativePageNonce', { value: '\(nonce)', configurable: false });\(forceMobileShell)"
        webView.configuration.userContentController.removeAllUserScripts()
        webView.configuration.userContentController.addUserScript(WKUserScript(
            source: source,
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true,
            in: .page
        ))
        bridge.beginNavigation(pageNonce: nonce)
    }

    private func isSameDocumentNavigation(_ navigationAction: WKNavigationAction) -> Bool {
        guard navigationAction.navigationType != .reload,
              let current = webView.url,
              let target = navigationAction.request.url else {
            return false
        }
        var currentParts = URLComponents(url: current, resolvingAgainstBaseURL: false)
        var targetParts = URLComponents(url: target, resolvingAgainstBaseURL: false)
        currentParts?.fragment = nil
        targetParts?.fragment = nil
        return currentParts?.url == targetParts?.url && current.fragment != target.fragment
    }

    func webView(
        _ webView: WKWebView,
        requestMediaCapturePermissionFor origin: WKSecurityOrigin,
        initiatedByFrame frame: WKFrameInfo,
        type: WKMediaCaptureType,
        decisionHandler: @escaping (WKPermissionDecision) -> Void
    ) {
        let matchesProfile = origin.protocol.caseInsensitiveCompare(allowedMediaProtocol ?? "") == .orderedSame
            && origin.host.caseInsensitiveCompare(allowedMediaHost ?? "") == .orderedSame
            && origin.port == allowedMediaPort
        decisionHandler(matchesProfile ? .grant : .deny)
    }
}
