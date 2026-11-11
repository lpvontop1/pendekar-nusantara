package com.lpvontop.pendekar

import android.annotation.SuppressLint
import android.app.Activity
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.view.View
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient

/**
 * Pendekar Nusantara — wrapper WebView fullscreen.
 * Game (HTML/CSS/JS) hidup di app/src/main/assets/www/.
 * Android 9 (API 28) ke atas. Tanpa dependensi AndroidX agar build manual ramping.
 */
class MainActivity : Activity() {

    private lateinit var webView: WebView

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        window.addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        webView = WebView(this)
        setContentView(webView)

        webView.setBackgroundColor(Color.parseColor("#171008"))
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true                 // localStorage: progres, koin, toko
            mediaPlaybackRequiresUserGesture = false // musik gamelan mulai saat gesture pertama
            allowFileAccess = true                   // file:///android_asset
            cacheMode = WebSettings.LOAD_DEFAULT
            useWideViewPort = false
            loadWithOverviewMode = false
            textZoom = 100
        }
        webView.isVerticalScrollBarEnabled = false
        webView.isHorizontalScrollBarEnabled = false
        webView.overScrollMode = View.OVER_SCROLL_NEVER

        webView.webViewClient = WebViewClient()
        webView.loadUrl("file:///android_asset/www/index.html")

        hideSystemBars()
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) hideSystemBars()
    }

    /** Immersive sticky penuh: tanpa status bar & navigasi, tanpa layout offset. */
    private fun hideSystemBars() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.setDecorFitsSystemWindows(false)
            val controller = window.insetsController ?: return
            controller.hide(WindowInsets.Type.systemBars())
            controller.systemBarsBehavior =
                WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        } else {
            @Suppress("DEPRECATION")
            window.decorView.systemUiVisibility =
                (View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                        or View.SYSTEM_UI_FLAG_FULLSCREEN
                        or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        or View.SYSTEM_UI_FLAG_LAYOUT_STABLE)
        }
    }

    /** Tombol back Android -> jeda di dalam game (bukan langsung keluar). */
    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        webView.evaluateJavascript(
            "window.onNativeBack ? window.onNativeBack() : null", null
        )
    }

    override fun onPause() {
        super.onPause()
        webView.pauseTimers()   // hemat baterai: hentikan loop JS saat app di latar
    }

    override fun onResume() {
        super.onResume()
        webView.resumeTimers()
        hideSystemBars()
    }

    override fun onDestroy() {
        webView.destroy()
        super.onDestroy()
    }
}
