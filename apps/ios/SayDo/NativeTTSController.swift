import AVFoundation
import Combine
import Foundation

@MainActor
final class NativeTTSController: NSObject, ObservableObject, @preconcurrency AVSpeechSynthesizerDelegate {
    @Published private(set) var phase: TTSPhase = .silent
    @Published private(set) var enabled = true

    private let synthesizer = AVSpeechSynthesizer()
    private var machine = TTSStateMachine()
    private var deduplicator = ReplyDeduplicator()
    private var speechGate = NativeReplySpeechGate()
    private var pendingUtteranceCount = 0

    override init() {
        super.init()
        synthesizer.delegate = self
    }

    func setEnabled(_ enabled: Bool) {
        self.enabled = enabled
        guard !enabled else { return }
        stopForCapture()
        if !synthesizer.isSpeaking {
            machine.silence()
            publishPhase()
        }
    }

    func consume(_ reply: NativeReply) {
        guard enabled else { return }
        guard deduplicator.register(sessionId: reply.sessionId, sentenceId: reply.sentenceId) else { return }
        guard speechGate.accepts(origin: reply.origin) else { return }
        let text = reply.text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }

        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playback, mode: .spokenAudio, options: [.duckOthers])
            try session.setActive(true)
        } catch {
            return
        }

        machine.queue()
        publishPhase()
        let utterance = AVSpeechUtterance(string: text)
        utterance.voice = AVSpeechSynthesisVoice(language: "zh-CN")
        utterance.rate = AVSpeechUtteranceDefaultSpeechRate
        pendingUtteranceCount += 1
        synthesizer.speak(utterance)
    }

    func stopForCapture() {
        guard synthesizer.isSpeaking || phase == .queued || phase == .speaking else { return }
        machine.interrupt()
        publishPhase()
        pendingUtteranceCount = 0
        synthesizer.stopSpeaking(at: .immediate)
    }

    func beginCapture() {
        speechGate.beginCapture()
        stopForCapture()
    }

    func endCapture() {
        speechGate.endCapture()
    }

    func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didStart utterance: AVSpeechUtterance) {
        pendingUtteranceCount = max(0, pendingUtteranceCount - 1)
        machine.startSpeaking()
        publishPhase()
    }

    func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
        machine.finish()
        if pendingUtteranceCount > 0 {
            machine.queue()
        }
        publishPhase()
    }

    func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didCancel utterance: AVSpeechUtterance) {
        pendingUtteranceCount = 0
        machine.interrupt()
        publishPhase()
    }

    private func publishPhase() {
        phase = machine.phase
    }
}
