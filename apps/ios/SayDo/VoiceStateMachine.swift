import CoreGraphics
import Foundation

enum VoicePermissionPolicy {
    static func allowsCapture(speech: PermissionDisposition, microphone: PermissionDisposition) -> Bool {
        !speech.blocksCapture && !microphone.blocksCapture
    }

    static func recoveryMessage(speech: PermissionDisposition, microphone: PermissionDisposition) -> String? {
        if speech == .restricted || microphone == .restricted {
            return "语音或麦克风受系统限制，请检查设备管理设置。"
        }
        if speech == .denied || microphone == .denied {
            return "语音或麦克风权限未开启，请到系统设置允许 SayDo 使用后再试。"
        }
        return nil
    }
}

enum CapturePhase: String, Equatable {
    case idle
    case authorizing
    case listening
    case finalizing
    case submitting
}

struct CaptureStateMachine: Equatable {
    private(set) var phase: CapturePhase = .idle
    private(set) var generation = 0

    mutating func beginAuthorization() -> Int {
        generation += 1
        phase = .authorizing
        return generation
    }

    mutating func beginListening(generation expected: Int) -> Bool {
        transition(from: .authorizing, to: .listening, generation: expected)
    }

    mutating func beginFinalizing(generation expected: Int) -> Bool {
        transition(from: .listening, to: .finalizing, generation: expected)
    }

    mutating func beginSubmitting(generation expected: Int) -> Bool {
        transition(from: .finalizing, to: .submitting, generation: expected)
    }

    mutating func finishSubmitting(generation expected: Int) -> Bool {
        transition(from: .submitting, to: .idle, generation: expected)
    }

    mutating func invalidate() {
        generation += 1
        phase = .idle
    }

    func accepts(generation expected: Int) -> Bool {
        expected == generation
    }

    private mutating func transition(from: CapturePhase, to: CapturePhase, generation expected: Int) -> Bool {
        guard generation == expected, phase == from else { return false }
        phase = to
        return true
    }
}

enum TTSPhase: String, Equatable {
    case silent
    case queued
    case speaking
    case interrupted
    case finished
}

struct TTSStateMachine: Equatable {
    private(set) var phase: TTSPhase = .silent

    mutating func queue() {
        if phase != .speaking {
            phase = .queued
        }
    }

    mutating func startSpeaking() {
        guard phase == .queued || phase == .speaking else { return }
        phase = .speaking
    }

    mutating func interrupt() {
        guard phase == .queued || phase == .speaking else { return }
        phase = .interrupted
    }

    mutating func finish() {
        guard phase == .speaking else { return }
        phase = .finished
    }

    mutating func silence() {
        phase = .silent
    }
}

struct ReplyDeduplicator {
    private var keys = Set<String>()

    mutating func register(sessionId: String, sentenceId: String) -> Bool {
        keys.insert("\(sessionId)\u{0}\(sentenceId)").inserted
    }
}

struct NativeReplySpeechGate {
    private(set) var captureActive = false

    mutating func beginCapture() {
        captureActive = true
    }

    mutating func endCapture() {
        captureActive = false
    }

    func accepts(origin: NativeReplyOrigin) -> Bool {
        !captureActive && (origin == .assistantReply || origin == .onboarding)
    }
}

enum FocusTitleSanitizer {
    static func sanitize(_ title: String) -> String {
        let flattened = title
            .replacingOccurrences(of: "]", with: "")
            .replacingOccurrences(of: "\r", with: " ")
            .replacingOccurrences(of: "\n", with: " ")
            .split(whereSeparator: { $0.isWhitespace })
            .joined(separator: " ")
        return String(flattened.prefix(64))
    }
}

enum VoiceGestureGeometry {
    static let horizontalInset: CGFloat = 14
    static let bottomInset: CGFloat = 8
    static let capsuleWidth: CGFloat = 232
    static let capsuleHeight: CGFloat = 48
    static let trayHeight: CGFloat = 56
    static let spacing: CGFloat = 9

    static func capsuleRect(in size: CGSize) -> CGRect {
        CGRect(
            x: (size.width - capsuleWidth) / 2,
            y: size.height - bottomInset - capsuleHeight,
            width: capsuleWidth,
            height: capsuleHeight
        )
    }

    static func trayRect(in size: CGSize) -> CGRect {
        let capsule = capsuleRect(in: size)
        return CGRect(
            x: horizontalInset,
            y: capsule.minY - spacing - trayHeight,
            width: max(0, size.width - horizontalInset * 2),
            height: trayHeight
        )
    }

    static func acceptsDrag(at point: CGPoint, in size: CGSize, trayOpen: Bool) -> Bool {
        let capsule = capsuleRect(in: size)
        if trayOpen {
            return capsule.union(trayRect(in: size)).contains(point)
        }
        return capsule.union(CGRect(
            x: capsule.minX,
            y: capsule.minY - spacing - trayHeight,
            width: capsule.width,
            height: spacing + trayHeight
        )).contains(point)
    }

    static func acceptsRelease(at point: CGPoint, in size: CGSize, trayOpen: Bool) -> Bool {
        let capsule = capsuleRect(in: size)
        return capsule.contains(point) || (trayOpen && trayRect(in: size).contains(point))
    }

    static func traySelection(at point: CGPoint, in size: CGSize, count: Int) -> Int {
        guard count > 0 else { return 0 }
        let tray = trayRect(in: size)
        let x = min(max(point.x - tray.minX, 0), max(0, tray.width - 1))
        return min(count - 1, Int(x / max(1, tray.width / CGFloat(count))))
    }
}
