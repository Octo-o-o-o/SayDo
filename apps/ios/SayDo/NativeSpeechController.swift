import AVFoundation
import Combine
import Foundation
import Speech

enum PermissionDisposition: String {
    case notDetermined
    case denied
    case restricted
    case authorized

    var label: String {
        switch self {
        case .notDetermined: "未询问"
        case .denied: "已拒绝"
        case .restricted: "受系统限制"
        case .authorized: "已授权"
        }
    }

    var blocksCapture: Bool {
        self == .denied || self == .restricted
    }
}

@MainActor
final class NativeSpeechController: ObservableObject {
    static let maximumCaptureDuration: TimeInterval = 60

    @Published private(set) var phase: CapturePhase = .idle
    @Published private(set) var transcript = ""
    @Published private(set) var probeSteps: [String] = []
    @Published private(set) var errorMessage: String?
    @Published private(set) var permissionSummary = "语音：未询问 · 麦克风：未询问"
    @Published private(set) var speechPermission: PermissionDisposition = .notDetermined
    @Published private(set) var microphonePermission: PermissionDisposition = .notDetermined
    @Published private(set) var serverOptInRequired = false

    var permissionsAllowCapture: Bool {
        VoicePermissionPolicy.allowsCapture(speech: speechPermission, microphone: microphonePermission)
    }

    var permissionRecoveryMessage: String? {
        VoicePermissionPolicy.recoveryMessage(speech: speechPermission, microphone: microphonePermission)
    }

    var onTranscriptReady: ((NativeTranscriptSubmission) -> Void)?

    private var machine = CaptureStateMachine()
    private let audioEngine = AVAudioEngine()
    private var recognizer: SFSpeechRecognizer?
    private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
    private var recognitionTask: SFSpeechRecognitionTask?
    private var durationTimer: Timer?
    private var finalFallbackTimer: Timer?
    private var tapInstalled = false
    private var captureId = ""
    private var latestResultIsFinal = false
    private var finishRequested = false
    private var requestedFocus: NativeFocus?
    private var maximumDurationHandler: (() -> Void)?

    func beginCapture(
        contextualStrings: [String],
        allowServerRecognition: Bool,
        onMaximumDuration: @escaping () -> Void
    ) async {
        guard phase == .idle else { return }
        let generation = machine.beginAuthorization()
        publishPhase()
        transcript = ""
        probeSteps = []
        errorMessage = nil
        serverOptInRequired = false
        finishRequested = false
        requestedFocus = nil
        latestResultIsFinal = false
        captureId = UUID().uuidString
        maximumDurationHandler = onMaximumDuration

        let speech = await authorizeSpeech()
        guard machine.accepts(generation: generation) else { return }
        let microphone = await authorizeMicrophone()
        guard machine.accepts(generation: generation) else { return }
        updatePermissionSummary(speech: speech, microphone: microphone)

        guard speech == .authorized else {
            fail(speech == .restricted ? "语音识别受系统限制，请检查设备管理设置。" : "语音识别权限未开启，请到系统设置允许 SayDo 使用语音识别。")
            return
        }
        guard microphone == .authorized else {
            fail(microphone == .restricted ? "麦克风受系统限制，请检查设备管理设置。" : "麦克风权限未开启，请到系统设置允许 SayDo 使用麦克风。")
            return
        }

        guard let recognizer = probeChineseRecognizer(allowServerRecognition: allowServerRecognition) else {
            fail(errorMessage ?? "中文识别当前不可用。")
            return
        }
        self.recognizer = recognizer
        do {
            try startRecognition(
                recognizer: recognizer,
                contextualStrings: contextualStrings,
                allowServerRecognition: allowServerRecognition,
                generation: generation
            )
        } catch {
            fail("录音启动失败，请稍后再试。")
            return
        }
        if finishRequested {
            beginFinalizing(focus: requestedFocus, generation: generation)
        }
    }

    func finishCapture(focus: NativeFocus?) {
        switch phase {
        case .authorizing:
            finishRequested = true
            requestedFocus = focus
        case .listening:
            beginFinalizing(focus: focus, generation: machine.generation)
        default:
            return
        }
    }

    func cancelCapture() {
        guard phase != .idle else { return }
        stopRecognition(cancelTask: true)
        machine.invalidate()
        publishPhase()
        transcript = ""
        errorMessage = "已取消，不会发送。"
    }

    func completeSubmission(_ result: NativeSubmissionResult, captureId completedCaptureId: String) {
        let generation = machine.generation
        guard phase == .submitting, completedCaptureId == captureId else { return }
        if result.status == .queuedToSocket || result.status == .drafted {
            _ = machine.finishSubmitting(generation: generation)
            errorMessage = result.status == .queuedToSocket ? "已排进发送队列。" : "转写已放进输入框。"
        } else {
            machine.invalidate()
            errorMessage = submissionErrorMessage(result.reason)
        }
        publishPhase()
        transcript = ""
    }

    func refreshPermissions() {
        updatePermissionSummary(
            speech: speechDisposition(SFSpeechRecognizer.authorizationStatus()),
            microphone: microphoneDisposition(AVAudioApplication.shared.recordPermission)
        )
    }

    private func authorizeSpeech() async -> PermissionDisposition {
        let current = SFSpeechRecognizer.authorizationStatus()
        guard current == .notDetermined else { return speechDisposition(current) }
        let requested = await withCheckedContinuation { continuation in
            SFSpeechRecognizer.requestAuthorization { continuation.resume(returning: $0) }
        }
        return speechDisposition(requested)
    }

    private func authorizeMicrophone() async -> PermissionDisposition {
        let current = AVAudioApplication.shared.recordPermission
        guard current == .undetermined else { return microphoneDisposition(current) }
        let granted = await withCheckedContinuation { continuation in
            AVAudioApplication.requestRecordPermission { continuation.resume(returning: $0) }
        }
        return granted ? .authorized : microphoneDisposition(AVAudioApplication.shared.recordPermission)
    }

    private func speechDisposition(_ status: SFSpeechRecognizerAuthorizationStatus) -> PermissionDisposition {
        switch status {
        case .notDetermined: .notDetermined
        case .denied: .denied
        case .restricted: .restricted
        case .authorized: .authorized
        @unknown default: .restricted
        }
    }

    private func microphoneDisposition(_ status: AVAudioApplication.recordPermission) -> PermissionDisposition {
        switch status {
        case .undetermined: .notDetermined
        case .denied: .denied
        case .granted: .authorized
        @unknown default: .restricted
        }
    }

    private func updatePermissionSummary(speech: PermissionDisposition, microphone: PermissionDisposition) {
        speechPermission = speech
        microphonePermission = microphone
        permissionSummary = "语音：\(speech.label) · 麦克风：\(microphone.label)"
    }

    private func probeChineseRecognizer(allowServerRecognition: Bool) -> SFSpeechRecognizer? {
        let locale = Locale(identifier: "zh-CN")
        let target = locale.identifier.replacingOccurrences(of: "_", with: "-").lowercased()
        guard SFSpeechRecognizer.supportedLocales().contains(where: {
            $0.identifier.replacingOccurrences(of: "_", with: "-").lowercased() == target
        }) else {
            errorMessage = "1/4 系统没有提供中文识别语言。"
            return nil
        }
        probeSteps.append("1/4 系统支持中文识别语言")
        guard let recognizer = SFSpeechRecognizer(locale: locale) else {
            errorMessage = "2/4 无法创建中文识别器。"
            return nil
        }
        probeSteps.append("2/4 已创建中文识别器")
        guard recognizer.isAvailable else {
            errorMessage = "3/4 中文识别服务当前不可用。"
            return nil
        }
        probeSteps.append("3/4 中文识别服务可用")
        if recognizer.supportsOnDeviceRecognition {
            probeSteps.append("4/4 设备内中文识别可用")
            return recognizer
        }
        guard allowServerRecognition else {
            serverOptInRequired = true
            errorMessage = "4/4 设备内中文识别不可用；如需联网识别，请在壳设置中显式开启。"
            return nil
        }
        probeSteps.append("4/4 已按你的设置使用联网中文识别")
        return recognizer
    }

    private func startRecognition(
        recognizer: SFSpeechRecognizer,
        contextualStrings: [String],
        allowServerRecognition: Bool,
        generation: Int
    ) throws {
        let request = SFSpeechAudioBufferRecognitionRequest()
        request.shouldReportPartialResults = true
        request.taskHint = .dictation
        request.contextualStrings = Array(contextualStrings.prefix(100))
        request.requiresOnDeviceRecognition = !allowServerRecognition || recognizer.supportsOnDeviceRecognition
        recognitionRequest = request

        let session = AVAudioSession.sharedInstance()
        try session.setCategory(.record, mode: .measurement, options: [.duckOthers])
        try session.setActive(true, options: .notifyOthersOnDeactivation)
        let input = audioEngine.inputNode
        let format = input.outputFormat(forBus: 0)
        guard format.sampleRate > 0, format.channelCount > 0 else {
            throw NSError(domain: "SayDoSpeech", code: 1)
        }
        input.installTap(onBus: 0, bufferSize: 1_024, format: format) { buffer, _ in
            request.append(buffer)
        }
        tapInstalled = true
        recognitionTask = recognizer.recognitionTask(with: request) { [weak self] result, error in
            Task { @MainActor in
                self?.handleRecognition(result: result, error: error, generation: generation)
            }
        }
        audioEngine.prepare()
        try audioEngine.start()
        guard machine.beginListening(generation: generation) else {
            throw NSError(domain: "SayDoSpeech", code: 2)
        }
        publishPhase()
        durationTimer = Timer.scheduledTimer(withTimeInterval: Self.maximumCaptureDuration, repeats: false) { [weak self] _ in
            Task { @MainActor in
                guard let self, self.machine.accepts(generation: generation), self.phase == .listening else { return }
                self.maximumDurationHandler?()
                if self.phase == .listening {
                    self.finishCapture(focus: nil)
                }
            }
        }
    }

    private func handleRecognition(result: SFSpeechRecognitionResult?, error: Error?, generation: Int) {
        guard machine.accepts(generation: generation) else { return }
        if let result {
            transcript = result.bestTranscription.formattedString
            latestResultIsFinal = result.isFinal
            if result.isFinal, phase == .finalizing {
                deliverTranscript(generation: generation)
                return
            }
        }
        guard error != nil else { return }
        if phase == .finalizing, !transcript.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            deliverTranscript(generation: generation)
        } else if phase == .listening {
            fail("识别中断了，请再试一次。")
        }
    }

    private func beginFinalizing(focus: NativeFocus?, generation: Int) {
        guard machine.beginFinalizing(generation: generation) else { return }
        requestedFocus = focus
        publishPhase()
        stopRecordingInput()
        if latestResultIsFinal {
            deliverTranscript(generation: generation)
            return
        }
        finalFallbackTimer = Timer.scheduledTimer(withTimeInterval: 1.2, repeats: false) { [weak self] _ in
            Task { @MainActor in
                self?.deliverTranscript(generation: generation)
            }
        }
    }

    private func deliverTranscript(generation: Int) {
        guard machine.accepts(generation: generation), phase == .finalizing else { return }
        finalFallbackTimer?.invalidate()
        finalFallbackTimer = nil
        let text = transcript.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else {
            fail("没听清，请再按住说一次。")
            return
        }
        guard machine.beginSubmitting(generation: generation) else { return }
        publishPhase()
        recognitionTask?.cancel()
        recognitionTask = nil
        recognitionRequest = nil
        onTranscriptReady?(NativeTranscriptSubmission(
            requestId: UUID().uuidString,
            captureId: captureId,
            text: text,
            focus: requestedFocus,
            action: "send"
        ))
    }

    private func stopRecordingInput() {
        durationTimer?.invalidate()
        durationTimer = nil
        if audioEngine.isRunning {
            audioEngine.stop()
        }
        if tapInstalled {
            audioEngine.inputNode.removeTap(onBus: 0)
            tapInstalled = false
        }
        recognitionRequest?.endAudio()
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }

    private func stopRecognition(cancelTask: Bool) {
        stopRecordingInput()
        finalFallbackTimer?.invalidate()
        finalFallbackTimer = nil
        if cancelTask {
            recognitionTask?.cancel()
        }
        recognitionTask = nil
        recognitionRequest = nil
        maximumDurationHandler = nil
    }

    private func fail(_ message: String) {
        stopRecognition(cancelTask: true)
        machine.invalidate()
        publishPhase()
        errorMessage = message
    }

    private func publishPhase() {
        phase = machine.phase
    }

    private func submissionErrorMessage(_ reason: String?) -> String {
        switch reason {
        case "draft_conflict": "输入框里已有文字，请先发送或清空；原草稿没有改动。"
        case "focus_mismatch": "选中的事已变化，请重新上滑选择。"
        case "offline": "还没发出去，等连接恢复后再试。"
        case "busy": "上一条还在排队，请稍等一下。"
        default: "没有排进发送队列，请再试一次。"
        }
    }
}
