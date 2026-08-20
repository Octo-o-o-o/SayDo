package com.octoooo.saydo

import android.content.Context
import android.graphics.Color
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.ViewConfiguration
import android.widget.FrameLayout
import android.widget.TextView

class PullToRefreshLayout(context: Context) : FrameLayout(context) {
    var scrollTarget: View? = null
    var onRefresh: (() -> Unit)? = null

    private val triggerDistance = 72.dp
    private val touchSlop = ViewConfiguration.get(context).scaledTouchSlop
    private val indicator = TextView(context).apply {
        gravity = Gravity.CENTER
        text = "下拉刷新"
        setTextColor(Color.DKGRAY)
        setBackgroundColor(Color.argb(235, 245, 245, 245))
        visibility = GONE
        elevation = 8.dp.toFloat()
    }
    private var initialY = 0f
    private var intercepting = false
    private var canStartPull = false

    init {
        addView(
            indicator,
            LayoutParams(LayoutParams.MATCH_PARENT, 44.dp, Gravity.TOP),
        )
    }

    override fun onInterceptTouchEvent(event: MotionEvent): Boolean {
        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                initialY = event.y
                intercepting = false
                canStartPull = scrollTarget?.canScrollVertically(-1) != true
            }

            MotionEvent.ACTION_MOVE -> {
                if (canStartPull && event.y - initialY > touchSlop * 2) {
                    intercepting = true
                    indicator.visibility = VISIBLE
                    parent?.requestDisallowInterceptTouchEvent(true)
                    return true
                }
            }

            MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> reset()
        }
        return intercepting
    }

    override fun onTouchEvent(event: MotionEvent): Boolean {
        if (!intercepting) return super.onTouchEvent(event)
        when (event.actionMasked) {
            MotionEvent.ACTION_MOVE -> {
                indicator.text = if (event.y - initialY >= triggerDistance) {
                    "松开刷新"
                } else {
                    "下拉刷新"
                }
            }

            MotionEvent.ACTION_UP -> {
                if (event.y - initialY >= triggerDistance) {
                    performClick()
                }
                reset()
            }

            MotionEvent.ACTION_CANCEL -> reset()
        }
        return true
    }

    override fun performClick(): Boolean {
        super.performClick()
        onRefresh?.invoke()
        return true
    }

    private fun reset() {
        intercepting = false
        canStartPull = false
        indicator.visibility = GONE
        indicator.text = "下拉刷新"
        parent?.requestDisallowInterceptTouchEvent(false)
    }
}

val Int.dp: Int
    get() = (this * android.content.res.Resources.getSystem().displayMetrics.density).toInt()
