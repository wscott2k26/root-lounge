import UIKit
import WebKit
import Network
import UserNotifications

@main
final class AppDelegate: UIResponder, UIApplicationDelegate {
    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        let window = UIWindow(frame: UIScreen.main.bounds)
        window.rootViewController = RootViewController()
        window.makeKeyAndVisible()
        self.window = window
        return true
    }
}

final class RootViewController: UIViewController, WKNavigationDelegate, WKScriptMessageHandler {
    private let homeURL = URL(string: "https://root-lounge.vercel.app/")!
    private let allowedHosts: Set<String> = ["root-lounge.vercel.app", "rootlounge.app"]
    private let pathMonitor = NWPathMonitor()
    private let monitorQueue = DispatchQueue(label: "RootLounge.Network")
    private let statusLabel = UILabel()
    private var webView: WKWebView!

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 7/255, green: 16/255, blue: 22/255, alpha: 1)
        configureWebView()
        configureLayout()
        configureNetworkMonitor()
        webView.load(URLRequest(url: homeURL, cachePolicy: .returnCacheDataElseLoad, timeoutInterval: 30))
    }

    private func configureWebView() {
        let controller = WKUserContentController()
        controller.add(self, name: "rootNative")
        let bootstrap = """
        window.RootNative = {
          share: () => window.webkit.messageHandlers.rootNative.postMessage({type:'share'}),
          haptic: () => window.webkit.messageHandlers.rootNative.postMessage({type:'haptic'}),
          notify: (title, body) => window.webkit.messageHandlers.rootNative.postMessage({type:'notify', title:title || 'Root Lounge', body:body || 'You have a Root Lounge update.'}),
          platform: 'ios'
        };
        window.dispatchEvent(new CustomEvent('rootnative', {detail:{platform:'ios'}}));
        """
        controller.addUserScript(WKUserScript(source: bootstrap, injectionTime: .atDocumentStart, forMainFrameOnly: false))
        let config = WKWebViewConfiguration()
        config.userContentController = controller
        config.websiteDataStore = .default()
        config.allowsInlineMediaPlayback = true
        webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = self
        webView.allowsBackForwardNavigationGestures = true
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.backgroundColor = view.backgroundColor
        webView.isOpaque = false
    }

    private func configureLayout() {
        statusLabel.translatesAutoresizingMaskIntoConstraints = false
        statusLabel.text = "Root Lounge • checking connection"
        statusLabel.font = .systemFont(ofSize: 12, weight: .semibold)
        statusLabel.textColor = .white
        statusLabel.backgroundColor = UIColor(red: 14/255, green: 35/255, blue: 44/255, alpha: 1)
        statusLabel.textAlignment = .center

        webView.translatesAutoresizingMaskIntoConstraints = false

        let share = nativeButton("Share", action: #selector(shareCurrent))
        let buzz = nativeButton("Buzz", action: #selector(haptic))
        let refresh = nativeButton("Refresh", action: #selector(refreshPage))
        let bar = UIStackView(arrangedSubviews: [share, buzz, refresh])
        bar.axis = .horizontal
        bar.distribution = .fillEqually
        bar.spacing = 8
        bar.layoutMargins = UIEdgeInsets(top: 6, left: 8, bottom: 8, right: 8)
        bar.isLayoutMarginsRelativeArrangement = true
        bar.backgroundColor = UIColor(red: 10/255, green: 20/255, blue: 28/255, alpha: 1)
        bar.translatesAutoresizingMaskIntoConstraints = false

        view.addSubview(statusLabel)
        view.addSubview(webView)
        view.addSubview(bar)

        NSLayoutConstraint.activate([
            statusLabel.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            statusLabel.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            statusLabel.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            statusLabel.heightAnchor.constraint(equalToConstant: 30),
            webView.topAnchor.constraint(equalTo: statusLabel.bottomAnchor),
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            webView.bottomAnchor.constraint(equalTo: bar.topAnchor),
            bar.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            bar.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            bar.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor),
            bar.heightAnchor.constraint(equalToConstant: 58)
        ])
    }

    private func nativeButton(_ title: String, action: Selector) -> UIButton {
        var config = UIButton.Configuration.filled()
        config.title = title
        config.cornerStyle = .medium
        config.baseBackgroundColor = UIColor(red: 24/255, green: 55/255, blue: 66/255, alpha: 1)
        config.baseForegroundColor = .white
        let button = UIButton(configuration: config)
        button.addTarget(self, action: action, for: .touchUpInside)
        return button
    }

    @objc private func shareCurrent() {
        let url = webView.url ?? homeURL
        let sheet = UIActivityViewController(activityItems: ["Root Lounge", url], applicationActivities: nil)
        if let popover = sheet.popoverPresentationController {
            popover.sourceView = view
            popover.sourceRect = CGRect(x: view.bounds.midX, y: view.bounds.maxY - 60, width: 1, height: 1)
        }
        present(sheet, animated: true)
    }

    @objc private func haptic() {
        let generator = UIImpactFeedbackGenerator(style: .medium)
        generator.prepare()
        generator.impactOccurred()
    }

    @objc private func refreshPage() { webView.reload() }

    private func configureNetworkMonitor() {
        pathMonitor.pathUpdateHandler = { [weak self] path in
            DispatchQueue.main.async {
                guard let self else { return }
                let online = path.status == .satisfied
                self.statusLabel.text = online ? "Root Lounge • online" : "Root Lounge • offline — reconnecting…"
                self.webView.evaluateJavaScript("window.dispatchEvent(new CustomEvent('rootnetwork',{detail:{online:\(online ? "true" : "false")}}));")
            }
        }
        pathMonitor.start(queue: monitorQueue)
    }

    private func scheduleLocalNotification(title: String, body: String) {
        let center = UNUserNotificationCenter.current()
        center.requestAuthorization(options: [.alert, .sound, .badge]) { granted, _ in
            guard granted else { return }
            let content = UNMutableNotificationContent()
            content.title = title
            content.body = body
            content.sound = .default
            let request = UNNotificationRequest(identifier: UUID().uuidString, content: content, trigger: nil)
            center.add(request)
        }
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "rootNative", let body = message.body as? [String: Any], let type = body["type"] as? String else { return }
        switch type {
        case "share": shareCurrent()
        case "haptic": haptic()
        case "notify":
            scheduleLocalNotification(title: body["title"] as? String ?? "Root Lounge", body: body["body"] as? String ?? "You have a Root Lounge update.")
        default: break
        }
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else { decisionHandler(.cancel); return }
        if url.scheme == "https", let host = url.host, allowedHosts.contains(host) {
            decisionHandler(.allow)
        } else if navigationAction.navigationType == .linkActivated {
            UIApplication.shared.open(url)
            decisionHandler(.cancel)
        } else {
            decisionHandler(.allow)
        }
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        statusLabel.text = "Root Lounge • reconnecting…"
    }

    deinit {
        pathMonitor.cancel()
        webView?.configuration.userContentController.removeScriptMessageHandler(forName: "rootNative")
    }
}
