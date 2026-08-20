package com.octoooo.saydo

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Color
import android.net.http.SslError
import android.view.Gravity
import android.view.ViewGroup
import android.webkit.PermissionRequest
import android.webkit.SslErrorHandler
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import java.net.URI

@SuppressLint("SetJavaScriptEnabled", "ViewConstructor")
class WebPanel(
    context: Context,
    private val onWebPermissionRequest: (PermissionRequest, Array<String>) -> Unit,
) : FrameLayout(context) {
    private val pullToRefresh = PullToRefreshLayout(context)
    private val webView = WebView(context)
    private val errorView = LinearLayout(context)
    private var loadedSignature: String? = null
    private var currentProfile: DesktopProfile? = null
    private var mainFrameFailed = false

    init {
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            mediaPlaybackRequiresUserGesture = false
            cacheMode = WebSettings.LOAD_DEFAULT
        }
        webView.webViewClient = object : WebViewClient() {
            override fun onPageStarted(view: WebView, url: String?, favicon: android.graphics.Bitmap?) {
                mainFrameFailed = false
                errorView.visibility = GONE
            }

            override fun onPageFinished(view: WebView, url: String?) {
                if (!mainFrameFailed) {
                    errorView.visibility = GONE
                }
            }

            override fun onReceivedError(
                view: WebView,
                request: WebResourceRequest,
                error: WebResourceError,
            ) {
                if (request.isForMainFrame) showLoadFailure()
            }

            override fun onReceivedHttpError(
                view: WebView,
                request: WebResourceRequest,
                errorResponse: WebResourceResponse,
            ) {
                if (request.isForMainFrame && errorResponse.statusCode >= 400) showLoadFailure()
            }

            override fun onReceivedSslError(
                view: WebView,
                handler: SslErrorHandler,
                error: SslError,
            ) {
                handler.cancel()
                showLoadFailure()
            }
        }
        webView.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest) {
                post {
                    val profile = currentProfile
                    val requestedResources = request.resources
                    if (
                        profile == null ||
                        !originMatches(request.origin.toString(), profile.url) ||
                        requestedResources.isEmpty() ||
                        requestedResources.any {
                            it != PermissionRequest.RESOURCE_AUDIO_CAPTURE &&
                                it != PermissionRequest.RESOURCE_VIDEO_CAPTURE
                        }
                    ) {
                        request.deny()
                        return@post
                    }
                    onWebPermissionRequest(request, requestedResources)
                }
            }
        }

        pullToRefresh.scrollTarget = webView
        pullToRefresh.onRefresh = ::reload
        pullToRefresh.addView(
            webView,
            0,
            LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT),
        )

        errorView.apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(28.dp, 28.dp, 28.dp, 28.dp)
            setBackgroundColor(Color.rgb(250, 250, 250))
            visibility = GONE

            addView(TextView(context).apply {
                setText(R.string.web_load_failure)
                textSize = 17f
                gravity = Gravity.CENTER
                setTextColor(Color.DKGRAY)
            })
            addView(Button(context).apply {
                text = "重试"
                isAllCaps = false
                setOnClickListener { reload() }
            }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
                topMargin = 16.dp
            })
        }
        pullToRefresh.addView(
            errorView,
            LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT),
        )
        addView(
            pullToRefresh,
            LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT),
        )
    }

    fun load(profile: DesktopProfile) {
        val signature = "${profile.id}|${profile.url}|${profile.token}"
        if (signature == loadedSignature) return
        currentProfile = profile
        loadedSignature = signature
        mainFrameFailed = false
        errorView.visibility = GONE
        webView.loadUrl(profile.authenticatedUrl)
    }

    fun release() {
        webView.stopLoading()
        webView.webChromeClient = null
        webView.webViewClient = WebViewClient()
        webView.destroy()
    }

    private fun reload() {
        mainFrameFailed = false
        errorView.visibility = GONE
        if (webView.url != null) {
            webView.reload()
        } else {
            currentProfile?.let { webView.loadUrl(it.authenticatedUrl) }
        }
    }

    private fun showLoadFailure() {
        mainFrameFailed = true
        errorView.visibility = VISIBLE
    }

    private fun originMatches(origin: String, baseUrl: String): Boolean = runCatching {
        val actual = URI(origin)
        val expected = URI(baseUrl)
        actual.scheme.equals(expected.scheme, ignoreCase = true) &&
            actual.host.equals(expected.host, ignoreCase = true) &&
            actual.port == expected.port
    }.getOrDefault(false)
}
