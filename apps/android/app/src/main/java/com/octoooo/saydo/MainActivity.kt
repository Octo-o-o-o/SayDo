package com.octoooo.saydo

import android.Manifest
import android.app.Dialog
import android.content.pm.PackageManager
import android.graphics.Color
import android.graphics.drawable.ColorDrawable
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.Window
import android.widget.Button
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import com.journeyapps.barcodescanner.ScanContract
import com.journeyapps.barcodescanner.ScanOptions
import java.net.URI

class MainActivity : AppCompatActivity() {
    private lateinit var store: ConnectionStore
    private lateinit var root: FrameLayout
    private var webPanel: WebPanel? = null
    private var pendingPermission: PendingPermission? = null

    private val scanLauncher = registerForActivityResult(ScanContract()) { result ->
        val contents = result.contents ?: return@registerForActivityResult
        runCatching { DesktopProfile.fromPairingUrl(contents) }
            .onSuccess(::showPairingConfirmation)
            .onFailure { showMessage(it.message ?: "二维码不是 SayDo 桌面配对地址，请重新扫描") }
    }

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions(),
    ) { grants ->
        val pending = pendingPermission ?: return@registerForActivityResult
        pendingPermission = null
        if (pending.permissions.all { grants[it] == true }) {
            runCatching { pending.request.grant(pending.resources) }
        } else {
            runCatching { pending.request.deny() }
            showMessage("请在系统设置中允许 SayDo 使用相机或麦克风")
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        store = ConnectionStore(this)
        root = FrameLayout(this)
        setContentView(root)
        renderRoot()
    }

    override fun onDestroy() {
        pendingPermission?.let { runCatching { it.request.deny() } }
        pendingPermission = null
        webPanel?.release()
        webPanel = null
        super.onDestroy()
    }

    private fun renderRoot() {
        webPanel?.release()
        webPanel = null
        root.removeAllViews()
        val content = store.currentProfile?.let(::createConnectedView) ?: createGuideView()
        root.addView(
            content,
            FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT,
            ),
        )
    }

    private fun createGuideView(): View = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        gravity = Gravity.CENTER
        setPadding(32.dp, 32.dp, 32.dp, 32.dp)

        addView(TextView(context).apply {
            setText(R.string.guide_title)
            textSize = 24f
            gravity = Gravity.CENTER
            setTextColor(Color.rgb(30, 30, 30))
        })
        addView(TextView(context).apply {
            text = "扫桌面上的二维码连接"
            textSize = 16f
            gravity = Gravity.CENTER
            setTextColor(Color.DKGRAY)
        }, LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.WRAP_CONTENT,
            ViewGroup.LayoutParams.WRAP_CONTENT,
        ).apply {
            topMargin = 8.dp
        })
        addView(Button(context).apply {
            text = "扫码连接"
            isAllCaps = false
            setOnClickListener { launchScanner() }
        }, LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.WRAP_CONTENT,
            ViewGroup.LayoutParams.WRAP_CONTENT,
        ).apply {
            topMargin = 20.dp
        })
    }

    private fun createConnectedView(profile: DesktopProfile): View = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL

        addView(Button(context).apply {
            text = getString(R.string.toolbar_profile, profile.name)
            textSize = 14f
            isAllCaps = false
            minHeight = 0
            minimumHeight = 0
            setPadding(12.dp, 0, 12.dp, 0)
            setBackgroundColor(Color.rgb(245, 245, 245))
            setTextColor(Color.rgb(45, 45, 45))
            setOnClickListener { showDesktopList() }
        }, LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            36.dp,
        ))

        webPanel = WebPanel(context, ::handleWebPermissionRequest).also { panel ->
            addView(panel, LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                0,
                1f,
            ))
            panel.load(profile)
        }
    }

    private fun launchScanner() {
        scanLauncher.launch(
            ScanOptions()
                .setDesiredBarcodeFormats(ScanOptions.QR_CODE)
                .setPrompt("将桌面端二维码放入取景框")
                .setBeepEnabled(false)
                .setBarcodeImageEnabled(false)
                .setOrientationLocked(false),
        )
    }

    private fun showPairingConfirmation(scannedProfile: DesktopProfile) {
        val content = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(24.dp, 8.dp, 24.dp, 0)
        }
        val nameInput = EditText(this).apply {
            setText(scannedProfile.name)
            hint = "桌面名称"
            selectAll()
            isSingleLine = true
        }
        val address = runCatching {
            val uri = URI(scannedProfile.url)
            "地址：${uri.host}:${uri.port}"
        }.getOrDefault("地址：${scannedProfile.url}")
        content.addView(nameInput)
        content.addView(TextView(this).apply {
            text = address
            setTextColor(Color.DKGRAY)
            setPadding(4.dp, 12.dp, 4.dp, 4.dp)
        })

        val dialog = AlertDialog.Builder(this)
            .setTitle("确认桌面")
            .setView(content)
            .setNegativeButton("重新扫描") { _, _ -> launchScanner() }
            .setNeutralButton("取消", null)
            .setPositiveButton("保存并连接", null)
            .create()
        dialog.setOnShowListener {
            dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener {
                val name = nameInput.text.toString().trim()
                if (name.isEmpty()) {
                    nameInput.error = "请输入桌面名称"
                    return@setOnClickListener
                }
                runCatching { store.add(scannedProfile.copy(name = name)) }
                    .onSuccess {
                        dialog.dismiss()
                        renderRoot()
                    }
                    .onFailure { showMessage(it.message ?: "无法保存桌面，请重试") }
            }
        }
        dialog.show()
    }

    private fun showDesktopList() {
        val dialog = Dialog(this)
        dialog.requestWindowFeature(Window.FEATURE_NO_TITLE)

        val sheet = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(16.dp, 12.dp, 16.dp, 20.dp)
            setBackgroundColor(Color.WHITE)
        }
        val header = LinearLayout(this).apply {
            gravity = Gravity.CENTER_VERTICAL
            addView(TextView(context).apply {
                text = "桌面"
                textSize = 20f
                setTextColor(Color.rgb(25, 25, 25))
            }, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
            addView(Button(context).apply {
                text = "添加"
                isAllCaps = false
                setOnClickListener {
                    dialog.dismiss()
                    launchScanner()
                }
            })
            addView(Button(context).apply {
                text = "关闭"
                isAllCaps = false
                setOnClickListener { dialog.dismiss() }
            })
        }
        sheet.addView(header)

        val rows = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        store.profiles.forEach { profile ->
            rows.addView(createDesktopRow(dialog, profile))
        }
        sheet.addView(
            ScrollView(this).apply { addView(rows) },
            LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT,
            ),
        )

        dialog.setContentView(sheet)
        dialog.show()
        dialog.window?.apply {
            setBackgroundDrawable(ColorDrawable(Color.TRANSPARENT))
            setGravity(Gravity.BOTTOM)
            setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
        }
    }

    private fun createDesktopRow(dialog: Dialog, profile: DesktopProfile): View =
        LinearLayout(this).apply {
            gravity = Gravity.CENTER_VERTICAL
            val address = runCatching {
                val uri = URI(profile.url)
                "${uri.host}:${uri.port}"
            }.getOrDefault(profile.url)
            addView(Button(context).apply {
                text = if (store.currentId == profile.id) {
                    getString(R.string.desktop_row_current, profile.name, address)
                } else {
                    getString(R.string.desktop_row, profile.name, address)
                }
                isAllCaps = false
                gravity = Gravity.START or Gravity.CENTER_VERTICAL
                setOnClickListener {
                    runCatching { store.select(profile.id) }
                        .onSuccess {
                            dialog.dismiss()
                            renderRoot()
                        }
                        .onFailure { showMessage(it.message ?: "无法切换桌面，请重试") }
                }
            }, LinearLayout.LayoutParams(0, 64.dp, 1f))
            addView(Button(context).apply {
                text = "删除"
                isAllCaps = false
                setOnClickListener {
                    runCatching { store.delete(profile.id) }
                        .onSuccess {
                            dialog.dismiss()
                            renderRoot()
                            if (store.profiles.isNotEmpty()) showDesktopList()
                        }
                        .onFailure { showMessage(it.message ?: "无法删除桌面，请重试") }
                }
            })
        }

    private fun handleWebPermissionRequest(
        request: android.webkit.PermissionRequest,
        resources: Array<String>,
    ) {
        val permissions = buildList {
            if (android.webkit.PermissionRequest.RESOURCE_AUDIO_CAPTURE in resources) {
                add(Manifest.permission.RECORD_AUDIO)
            }
            if (android.webkit.PermissionRequest.RESOURCE_VIDEO_CAPTURE in resources) {
                add(Manifest.permission.CAMERA)
            }
        }.distinct().toTypedArray()
        if (permissions.isEmpty()) {
            request.deny()
            return
        }
        val missingPermissions = permissions.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }.toTypedArray()
        if (missingPermissions.isEmpty()) {
            request.grant(resources)
            return
        }

        pendingPermission?.let { runCatching { it.request.deny() } }
        pendingPermission = PendingPermission(request, resources, missingPermissions)
        permissionLauncher.launch(missingPermissions)
    }

    private fun showMessage(message: String) {
        Toast.makeText(this, message, Toast.LENGTH_LONG).show()
    }

    private data class PendingPermission(
        val request: android.webkit.PermissionRequest,
        val resources: Array<String>,
        val permissions: Array<String>,
    )
}
