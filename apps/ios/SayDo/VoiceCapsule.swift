import SwiftUI
import UIKit

struct VoiceCapsule: View {
    @ObservedObject var bridge: NativeBridgeController
    @ObservedObject var speech: NativeSpeechController
    @ObservedObject var tts: NativeTTSController
    let allowServerRecognition: Bool

    @State private var gestureActive = false
    @State private var trayOpen = false
    @State private var traySelection = 0
    @State private var dragCancelled = false

    private var canStart: Bool {
        bridge.pageReady
            && bridge.daemonStatus == .online
            && speech.phase == .idle
            && !speech.hasRecoverableTranscript
            && speech.permissionsAllowCapture
    }

    var body: some View {
        GeometryReader { proxy in
            VStack(spacing: 9) {
                Spacer(minLength: 0)
                if let statusText {
                    Text(statusText)
                        .font(.footnote.weight(.medium))
                        .foregroundStyle(.primary)
                        .multilineTextAlignment(.center)
                        .lineLimit(speech.errorMessage == nil ? 3 : nil)
                        .padding(.horizontal, 13)
                        .padding(.vertical, 8)
                        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 12))
                        .frame(maxWidth: min(proxy.size.width - 28, 380))
                        .allowsHitTesting(false)
                }
                if speech.hasRecoverableTranscript {
                    NativeTranscriptRecoveryView(speech: speech)
                }
                if trayOpen {
                    focusTray
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                }
                capsule
                    .contentShape(Capsule())
                    .gesture(capsuleGesture(in: proxy.size))
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel("按住说话")
                    .accessibilityValue(accessibilityValue)
                    .accessibilityHint("双击开始录音，再双击发送；录音时会立即停止朗读")
                    .accessibilityAddTraits(.isButton)
                    .accessibilityAction {
                        accessibilityToggle()
                    }
                    .accessibilityAction(named: Text("开始或发送录音")) {
                        accessibilityToggle()
                    }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .padding(.horizontal, 14)
            .padding(.bottom, 8)
        }
        .coordinateSpace(name: "voice-capsule-overlay")
        .animation(.easeOut(duration: 0.16), value: trayOpen)
    }

    private var capsule: some View {
        HStack(spacing: 10) {
            Image(systemName: speech.phase == .listening ? "waveform" : "mic.fill")
                .font(.headline)
            Text(capsuleLabel)
                .font(.headline)
                .lineLimit(1)
            if speech.phase == .listening {
                Circle()
                    .fill(.white.opacity(0.88))
                    .frame(width: 7, height: 7)
            }
        }
        .foregroundStyle(.white)
        .frame(width: VoiceGestureGeometry.capsuleWidth, height: VoiceGestureGeometry.capsuleHeight)
        .background(dragCancelled ? Color.gray : Color(red: 0.13, green: 0.24, blue: 0.39), in: Capsule())
        .shadow(color: .black.opacity(0.2), radius: 10, y: 5)
        .opacity(canStart || speech.phase != .idle ? 1 : 0.58)
    }

    private var focusTray: some View {
        HStack(spacing: 6) {
            trayCell(title: "新会话", selected: traySelection == 0)
            ForEach(Array(bridge.focuses.prefix(3).enumerated()), id: \.element.id) { index, focus in
                trayCell(title: focus.title.isEmpty ? "未命名" : focus.title, selected: traySelection == index + 1)
            }
        }
        .padding(7)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 15))
        .shadow(color: .black.opacity(0.14), radius: 8, y: 4)
        .accessibilityLabel("选择归属")
        .allowsHitTesting(false)
    }

    private func trayCell(title: String, selected: Bool) -> some View {
        Text(title)
            .font(.caption.weight(selected ? .semibold : .regular))
            .lineLimit(2)
            .multilineTextAlignment(.center)
            .foregroundStyle(selected ? .white : .primary)
            .frame(maxWidth: .infinity, minHeight: 42)
            .padding(.horizontal, 5)
            .background(selected ? Color(red: 0.13, green: 0.24, blue: 0.39) : .clear, in: RoundedRectangle(cornerRadius: 10))
    }

    private func capsuleGesture(in size: CGSize) -> some Gesture {
        DragGesture(minimumDistance: 0, coordinateSpace: .named("voice-capsule-overlay"))
            .onChanged { value in
                if !gestureActive {
                    gestureActive = true
                    trayOpen = false
                    traySelection = 0
                    dragCancelled = false
                    startCapture()
                }
                if value.translation.height < -48, !dragCancelled {
                    if !trayOpen {
                        trayOpen = true
                        UIImpactFeedbackGenerator(style: .light).impactOccurred()
                    }
                    if abs(value.translation.width) > 18 {
                        let count = bridge.focuses.prefix(3).count + 1
                        let next = VoiceGestureGeometry.traySelection(at: value.location, in: size, count: count)
                        if next != traySelection {
                            traySelection = next
                            UISelectionFeedbackGenerator().selectionChanged()
                        }
                    }
                }
                if !VoiceGestureGeometry.acceptsDrag(at: value.location, in: size, trayOpen: trayOpen) {
                    dragCancelled = true
                }
            }
            .onEnded { value in
                defer {
                    gestureActive = false
                    trayOpen = false
                    dragCancelled = false
                }
                let validRelease = VoiceGestureGeometry.acceptsRelease(
                    at: value.location,
                    in: size,
                    trayOpen: trayOpen
                )
                if dragCancelled || !validRelease || speech.phase == .idle {
                    speech.cancelCapture()
                    UINotificationFeedbackGenerator().notificationOccurred(.warning)
                    return
                }
                speech.finishCapture(focus: selectedFocus)
                UIImpactFeedbackGenerator(style: .medium).impactOccurred()
            }
    }

    private var selectedFocus: NativeFocus? {
        guard trayOpen, traySelection > 0 else { return nil }
        let focuses = Array(bridge.focuses.prefix(3))
        let index = traySelection - 1
        return focuses.indices.contains(index) ? focuses[index] : nil
    }

    private func startCapture() {
        guard canStart else {
            UINotificationFeedbackGenerator().notificationOccurred(.error)
            return
        }
        tts.beginCapture()
        UIImpactFeedbackGenerator(style: .rigid).impactOccurred()
        Task {
            await speech.beginCapture(
                contextualStrings: bridge.focuses.map(\.title),
                allowServerRecognition: allowServerRecognition,
                onMaximumDuration: {
                    speech.finishCapture(focus: selectedFocus)
                    UINotificationFeedbackGenerator().notificationOccurred(.warning)
                }
            )
        }
    }

    private func accessibilityToggle() {
        switch speech.phase {
        case .idle:
            startCapture()
        case .authorizing, .listening:
            speech.finishCapture(focus: nil)
            UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        case .finalizing, .submitting:
            break
        }
    }

    private var capsuleLabel: String {
        switch speech.phase {
        case .idle:
            if speech.hasRecoverableTranscript { "先处理保留转写" }
            else if !speech.permissionsAllowCapture { "语音权限未开启" }
            else { canStart ? "按住说话" : "等待桌面连接" }
        case .authorizing: "正在检查授权"
        case .listening: trayOpen ? "上滑选择归属" : "松开发送 · 上滑选事"
        case .finalizing: "正在收尾转写"
        case .submitting: "正在排队发送"
        }
    }

    private var accessibilityValue: String {
        [capsuleLabel, speech.permissionSummary].joined(separator: "，")
    }

    private var statusText: String? {
        if let error = speech.errorMessage {
            return error
        }
        if !speech.hasRecoverableTranscript, !speech.transcript.isEmpty {
            return speech.transcript
        }
        if let recovery = speech.permissionRecoveryMessage {
            return recovery
        }
        return speech.probeSteps.last
    }
}

// 恢复动作只编辑/复制本机稿件,不调用 submit 或重新生成 captureId。
struct NativeTranscriptRecoveryView: View {
    @ObservedObject var speech: NativeSpeechController
    @State private var editedText = ""
    @State private var confirmsDiscard = false

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("保留的转写")
                .font(.headline)
            TextEditor(text: $editedText)
                .font(.body)
                .frame(height: 140)
                .accessibilityLabel("编辑保留的转写")
            HStack {
                Button("保留修改") {
                    speech.editRecoveredTranscript(editedText)
                }
                .disabled(editedText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                Button("复制") {
                    UIPasteboard.general.string = editedText
                }
                .disabled(editedText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                Spacer()
                Button("丢弃", role: .destructive) { confirmsDiscard = true }
            }
            Text("仅保留在本机，不会自动重发。丢弃后才能开始新录音。")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(12)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 12))
        .frame(maxWidth: 380)
        .onAppear { editedText = speech.transcript }
        .onChange(of: speech.transcript) { _, text in editedText = text }
        .confirmationDialog("丢弃保留的转写？", isPresented: $confirmsDiscard, titleVisibility: .visible) {
            Button("丢弃转写", role: .destructive) { speech.discardRecoveredTranscript() }
            Button("继续保留", role: .cancel) { }
        }
    }
}
