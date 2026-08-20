import SwiftUI

struct RootView: View {
    @StateObject private var store = ConnectionStore()
    @StateObject private var bridge = NativeBridgeController()
    @StateObject private var speech = NativeSpeechController()
    @StateObject private var tts = NativeTTSController()
    @AppStorage("saydo.ttsEnabled") private var ttsEnabled = true
    @AppStorage("saydo.serverRecognitionEnabled") private var serverRecognitionEnabled = false
    @Environment(\.scenePhase) private var scenePhase
    @State private var showsPairing = false
    @State private var showsDesktopList = false
    @State private var pairsAfterDesktopList = false
    /// 递增以驱动 WebContainer 注入 saydo:native-resume（回前台立即重连）。
    @State private var webResumeToken = 0

    var body: some View {
        Group {
            if let profile = store.currentProfile {
                VStack(spacing: 0) {
                    Button {
                        showsDesktopList = true
                    } label: {
                        HStack(spacing: 6) {
                            Text(profile.name)
                                .font(.subheadline.weight(.medium))
                                .lineLimit(1)
                            Image(systemName: "chevron.down")
                                .font(.caption)
                        }
                        .frame(maxWidth: .infinity)
                        .frame(height: 36)
                    }
                    .buttonStyle(.plain)
                    .background(.thinMaterial)

                    Divider()
                    ZStack {
                        WebContainer(profile: profile, bridge: bridge, resumeToken: webResumeToken)
                            .id(profile.id)
                        VoiceCapsule(
                            bridge: bridge,
                            speech: speech,
                            tts: tts,
                            allowServerRecognition: serverRecognitionEnabled
                        )
                    }
                }
            } else {
                ContentUnavailableView {
                    Label("连接 SayDo", systemImage: "desktopcomputer")
                } description: {
                    Text("扫桌面上的二维码连接")
                } actions: {
                    Button("扫码") {
                        showsPairing = true
                    }
                    .buttonStyle(.borderedProminent)
                }
            }
        }
        .sheet(isPresented: $showsPairing) {
            PairingView(store: store)
        }
        .sheet(isPresented: $showsDesktopList, onDismiss: openPairingAfterDesktopList) {
            DesktopListView(store: store) {
                pairsAfterDesktopList = true
                showsDesktopList = false
            }
        }
        .onAppear(perform: configureNativeVoice)
        .onChange(of: ttsEnabled) { _, enabled in
            tts.setEnabled(enabled)
        }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active {
                speech.refreshPermissions()
                // onResume：通知 WebView 立即重连 daemon WS
                webResumeToken += 1
            }
        }
        .onChange(of: bridge.pageReady) { _, ready in
            if !ready {
                speech.cancelCapture()
                tts.stopForCapture()
            }
        }
        .onChange(of: speech.phase) { _, phase in
            if phase == .idle {
                tts.endCapture()
            }
        }
    }

    private func openPairingAfterDesktopList() {
        guard pairsAfterDesktopList else { return }
        pairsAfterDesktopList = false
        showsPairing = true
    }

    private func configureNativeVoice() {
        tts.setEnabled(ttsEnabled)
        speech.refreshPermissions()
        let ttsController = tts
        bridge.onReply = { [weak ttsController] reply in
            ttsController?.consume(reply)
        }
        let bridgeController = bridge
        let speechController = speech
        speech.onTranscriptReady = { [weak bridgeController, weak speechController] submission in
            Task { @MainActor in
                guard let bridgeController, let speechController else { return }
                let result = await bridgeController.submit(submission)
                speechController.completeSubmission(result, captureId: submission.captureId)
            }
        }
    }
}

private struct PairingView: View {
    @ObservedObject var store: ConnectionStore
    @Environment(\.dismiss) private var dismiss
    @State private var profile: DesktopProfile?
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            Group {
                if profile != nil {
                    Form {
                        Section("桌面信息") {
                            TextField("桌面名称", text: Binding(
                                get: { profile?.name ?? "" },
                                set: { profile?.name = $0 }
                            ))
                            .textInputAutocapitalization(.never)

                            LabeledContent("地址", value: profile?.url.host ?? "")
                        }

                        if let errorMessage {
                            Text(errorMessage)
                                .foregroundStyle(.red)
                        }

                        Button("保存并连接") {
                            saveProfile()
                        }
                        .disabled(profile?.name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty != false)

                        Button("重新扫描", role: .cancel) {
                            profile = nil
                            errorMessage = nil
                        }
                    }
                } else {
                    ZStack(alignment: .bottom) {
                        ScannerView { result in
                            switch result {
                            case .success(let scannedProfile):
                                profile = scannedProfile
                                errorMessage = nil
                            case .failure(let error):
                                errorMessage = error.localizedDescription
                            }
                        }
                        .ignoresSafeArea(edges: .bottom)

                        VStack(spacing: 8) {
                            Text("将桌面端二维码放入取景框")
                                .font(.headline)
                            if let errorMessage {
                                Text(errorMessage)
                                    .font(.footnote)
                                    .foregroundStyle(.red)
                            }
                        }
                        .multilineTextAlignment(.center)
                        .padding()
                        .frame(maxWidth: .infinity)
                        .background(.regularMaterial)
                    }
                }
            }
            .navigationTitle(profile == nil ? "扫码连接" : "确认桌面")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("取消") {
                        dismiss()
                    }
                }
            }
        }
    }

    private func saveProfile() {
        guard var profile else { return }
        profile.name = profile.name.trimmingCharacters(in: .whitespacesAndNewlines)
        do {
            try store.add(profile)
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

private struct DesktopListView: View {
    @ObservedObject var store: ConnectionStore
    let onAdd: () -> Void
    @Environment(\.dismiss) private var dismiss
    @AppStorage("saydo.ttsEnabled") private var ttsEnabled = true
    @AppStorage("saydo.serverRecognitionEnabled") private var serverRecognitionEnabled = false

    var body: some View {
        NavigationStack {
            List {
                Section("桌面") {
                    ForEach(store.profiles) { profile in
                        Button {
                            store.select(profile.id)
                            dismiss()
                        } label: {
                            HStack {
                                VStack(alignment: .leading, spacing: 3) {
                                    Text(profile.name)
                                        .foregroundStyle(.primary)
                                    Text(address(for: profile))
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                                Spacer()
                                if store.currentId == profile.id {
                                    Image(systemName: "checkmark")
                                        .foregroundStyle(.tint)
                                }
                            }
                        }
                    }
                    .onDelete(perform: deleteProfiles)
                }
                Section("壳设置") {
                    Toggle("朗读回复", isOn: $ttsEnabled)
                    Toggle("允许联网中文识别", isOn: $serverRecognitionEnabled)
                    Text("联网识别只在设备内中文识别不可用时启用，不会静默切换。")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .navigationTitle("桌面")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("关闭") {
                        dismiss()
                    }
                }
                ToolbarItemGroup(placement: .primaryAction) {
                    EditButton()
                    Button("添加") {
                        onAdd()
                    }
                }
            }
        }
    }

    private func deleteProfiles(at offsets: IndexSet) {
        let ids = offsets.map { store.profiles[$0].id }
        ids.forEach(store.delete)
        if store.profiles.isEmpty {
            dismiss()
        }
    }

    private func address(for profile: DesktopProfile) -> String {
        guard let host = profile.url.host else { return profile.url.absoluteString }
        if let port = profile.url.port {
            return "\(host):\(port)"
        }
        return host
    }
}
