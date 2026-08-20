import XCTest
@testable import SayDo

final class VoiceStateMachineTests: XCTestCase {
    func testCaptureHappyPathUsesFrozenOrder() {
        var machine = CaptureStateMachine()
        let generation = machine.beginAuthorization()
        XCTAssertEqual(machine.phase, .authorizing)
        XCTAssertTrue(machine.beginListening(generation: generation))
        XCTAssertEqual(machine.phase, .listening)
        XCTAssertTrue(machine.beginFinalizing(generation: generation))
        XCTAssertEqual(machine.phase, .finalizing)
        XCTAssertTrue(machine.beginSubmitting(generation: generation))
        XCTAssertEqual(machine.phase, .submitting)
        XCTAssertTrue(machine.finishSubmitting(generation: generation))
        XCTAssertEqual(machine.phase, .idle)
    }

    func testCaptureGenerationRejectsLateCallbacks() {
        var machine = CaptureStateMachine()
        let staleGeneration = machine.beginAuthorization()
        machine.invalidate()
        let currentGeneration = machine.beginAuthorization()

        XCTAssertFalse(machine.accepts(generation: staleGeneration))
        XCTAssertFalse(machine.beginListening(generation: staleGeneration))
        XCTAssertEqual(machine.phase, .authorizing)
        XCTAssertTrue(machine.beginListening(generation: currentGeneration))
    }

    func testTTSFrozenTransitions() {
        var machine = TTSStateMachine()
        machine.queue()
        XCTAssertEqual(machine.phase, .queued)
        machine.startSpeaking()
        XCTAssertEqual(machine.phase, .speaking)
        machine.interrupt()
        XCTAssertEqual(machine.phase, .interrupted)

        machine.queue()
        machine.startSpeaking()
        machine.finish()
        XCTAssertEqual(machine.phase, .finished)
    }

    func testReplyDeduplicationUsesSessionAndSentence() {
        var deduplicator = ReplyDeduplicator()
        XCTAssertTrue(deduplicator.register(sessionId: "session-a", sentenceId: "sentence-1"))
        XCTAssertFalse(deduplicator.register(sessionId: "session-a", sentenceId: "sentence-1"))
        XCTAssertTrue(deduplicator.register(sessionId: "session-b", sentenceId: "sentence-1"))
    }

    func testNativeReplySpeechGateRejectsUnsafeOriginsAndCaptureOverlap() {
        var gate = NativeReplySpeechGate()
        XCTAssertTrue(gate.accepts(origin: .assistantReply))
        XCTAssertTrue(gate.accepts(origin: .onboarding))
        XCTAssertFalse(gate.accepts(origin: .system))
        XCTAssertFalse(gate.accepts(origin: .confirmation))

        gate.beginCapture()
        XCTAssertFalse(gate.accepts(origin: .assistantReply))
        gate.endCapture()
        XCTAssertTrue(gate.accepts(origin: .assistantReply))
    }

    func testFocusTitleSanitizerRemovesBracketAndNewlineThenTruncates() {
        let title = "]第一行\n第二行 " + String(repeating: "字", count: 80)
        let sanitized = FocusTitleSanitizer.sanitize(title)
        XCTAssertFalse(sanitized.contains("]"))
        XCTAssertFalse(sanitized.contains("\n"))
        XCTAssertEqual(sanitized.count, 64)
    }

    func testNativeBridgeOriginNormalizesDefaultPortsAndRejectsAnotherOrigin() throws {
        let origin = try XCTUnwrap(NativeBridgeOrigin(url: URL(string: "http://saydo.local/m" )!))
        XCTAssertTrue(origin.matches(scheme: "HTTP", host: "SAYDO.LOCAL", port: 80))
        XCTAssertTrue(origin.matches(url: URL(string: "http://saydo.local:80/other")))
        XCTAssertFalse(origin.matches(url: URL(string: "https://saydo.local/m")))
        XCTAssertFalse(origin.matches(url: URL(string: "http://other.local/m")))
    }

    func testPermissionDispositionOnlyBlocksDeniedAndRestricted() {
        XCTAssertFalse(PermissionDisposition.notDetermined.blocksCapture)
        XCTAssertFalse(PermissionDisposition.authorized.blocksCapture)
        XCTAssertTrue(PermissionDisposition.denied.blocksCapture)
        XCTAssertTrue(PermissionDisposition.restricted.blocksCapture)
        XCTAssertEqual(NativeSpeechController.maximumCaptureDuration, 60)
        XCTAssertTrue(VoicePermissionPolicy.allowsCapture(speech: .notDetermined, microphone: .authorized))
        XCTAssertFalse(VoicePermissionPolicy.allowsCapture(speech: .denied, microphone: .authorized))
        XCTAssertEqual(
            VoicePermissionPolicy.recoveryMessage(speech: .denied, microphone: .authorized),
            "语音或麦克风权限未开启，请到系统设置允许 SayDo 使用后再试。"
        )
        XCTAssertEqual(
            VoicePermissionPolicy.recoveryMessage(speech: .authorized, microphone: .restricted),
            "语音或麦克风受系统限制，请检查设备管理设置。"
        )
    }

    func testVoiceGestureReleaseRejectsAllFourCapsuleEdgesAndAcceptsTray() {
        let size = CGSize(width: 390, height: 844)
        let capsule = VoiceGestureGeometry.capsuleRect(in: size)
        XCTAssertTrue(VoiceGestureGeometry.acceptsRelease(at: capsule.center, in: size, trayOpen: false))
        XCTAssertFalse(VoiceGestureGeometry.acceptsRelease(at: CGPoint(x: capsule.minX - 1, y: capsule.midY), in: size, trayOpen: false))
        XCTAssertFalse(VoiceGestureGeometry.acceptsRelease(at: CGPoint(x: capsule.maxX + 1, y: capsule.midY), in: size, trayOpen: false))
        XCTAssertFalse(VoiceGestureGeometry.acceptsRelease(at: CGPoint(x: capsule.midX, y: capsule.minY - 1), in: size, trayOpen: false))
        XCTAssertFalse(VoiceGestureGeometry.acceptsRelease(at: CGPoint(x: capsule.midX, y: capsule.maxY + 1), in: size, trayOpen: false))

        let tray = VoiceGestureGeometry.trayRect(in: size)
        let gap = CGPoint(x: capsule.midX, y: capsule.minY - VoiceGestureGeometry.spacing / 2)
        XCTAssertTrue(VoiceGestureGeometry.acceptsDrag(at: gap, in: size, trayOpen: true))
        XCTAssertFalse(VoiceGestureGeometry.acceptsRelease(at: gap, in: size, trayOpen: true))
        XCTAssertTrue(VoiceGestureGeometry.acceptsRelease(at: tray.center, in: size, trayOpen: true))
        XCTAssertFalse(VoiceGestureGeometry.acceptsRelease(at: CGPoint(x: tray.minX - 1, y: tray.midY), in: size, trayOpen: true))
    }
}

private extension CGRect {
    var center: CGPoint { CGPoint(x: midX, y: midY) }
}
