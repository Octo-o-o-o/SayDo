import AVFoundation
import SwiftUI
import UIKit

struct ScannerView: UIViewControllerRepresentable {
    let onResult: (Result<DesktopProfile, ScannerError>) -> Void

    func makeUIViewController(context: Context) -> ScannerViewController {
        ScannerViewController(onResult: onResult)
    }

    func updateUIViewController(_ uiViewController: ScannerViewController, context: Context) {}
}

enum ScannerError: LocalizedError {
    case cameraUnavailable
    case cameraPermissionDenied
    case invalidPairingURL

    var errorDescription: String? {
        switch self {
        case .cameraUnavailable:
            return "当前设备无法使用相机"
        case .cameraPermissionDenied:
            return "请在系统设置中允许 SayDo 使用相机"
        case .invalidPairingURL:
            return PairingURLValidationError.invalidFormat.errorDescription
        }
    }
}

final class ScannerViewController: UIViewController, AVCaptureMetadataOutputObjectsDelegate {
    private let captureSession = AVCaptureSession()
    private let captureQueue = DispatchQueue(label: "com.octoooo.saydo.qr-capture")
    private let onResult: (Result<DesktopProfile, ScannerError>) -> Void
    private var previewLayer: AVCaptureVideoPreviewLayer?
    private var isConfigured = false
    private var acceptsScan = true

    init(onResult: @escaping (Result<DesktopProfile, ScannerError>) -> Void) {
        self.onResult = onResult
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black
        prepareCamera()
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        previewLayer?.frame = view.bounds
    }

    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        stopSession()
    }

    private func prepareCamera() {
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized:
            configureSession()
        case .notDetermined:
            AVCaptureDevice.requestAccess(for: .video) { [weak self] granted in
                DispatchQueue.main.async {
                    if granted {
                        self?.configureSession()
                    } else {
                        self?.onResult(.failure(.cameraPermissionDenied))
                    }
                }
            }
        default:
            onResult(.failure(.cameraPermissionDenied))
        }
    }

    private func configureSession() {
        guard !isConfigured else { return }
        guard let camera = AVCaptureDevice.default(for: .video),
              let input = try? AVCaptureDeviceInput(device: camera),
              captureSession.canAddInput(input) else {
            onResult(.failure(.cameraUnavailable))
            return
        }

        let output = AVCaptureMetadataOutput()
        guard captureSession.canAddOutput(output) else {
            onResult(.failure(.cameraUnavailable))
            return
        }

        captureSession.beginConfiguration()
        captureSession.addInput(input)
        captureSession.addOutput(output)
        output.setMetadataObjectsDelegate(self, queue: .main)
        output.metadataObjectTypes = [.qr]
        captureSession.commitConfiguration()

        let previewLayer = AVCaptureVideoPreviewLayer(session: captureSession)
        previewLayer.videoGravity = .resizeAspectFill
        previewLayer.frame = view.bounds
        view.layer.insertSublayer(previewLayer, at: 0)
        self.previewLayer = previewLayer
        isConfigured = true
        startSession()
    }

    private func startSession() {
        captureQueue.async { [weak self] in
            guard let self, !captureSession.isRunning else { return }
            captureSession.startRunning()
        }
    }

    private func stopSession() {
        captureQueue.async { [weak self] in
            guard let self, captureSession.isRunning else { return }
            captureSession.stopRunning()
        }
    }

    func metadataOutput(
        _ output: AVCaptureMetadataOutput,
        didOutput metadataObjects: [AVMetadataObject],
        from connection: AVCaptureConnection
    ) {
        guard acceptsScan,
              let code = metadataObjects.first as? AVMetadataMachineReadableCodeObject,
              let value = code.stringValue else {
            return
        }

        do {
            let profile = try DesktopProfile(pairingURLString: value)
            acceptsScan = false
            stopSession()
            onResult(.success(profile))
        } catch {
            rejectInvalidCode()
        }
    }

    private func rejectInvalidCode() {
        acceptsScan = false
        onResult(.failure(.invalidPairingURL))
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { [weak self] in
            self?.acceptsScan = true
        }
    }
}
