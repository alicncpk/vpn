package com.alicncvpn

import android.app.Activity
import android.content.Intent
import android.net.VpnService
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.BaseActivityEventListener
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise

class AliCncVpnModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    private var pendingPromise: Promise? = null
    private val VPN_REQUEST_CODE = 4224

    private val activityEventListener: ActivityEventListener = object : BaseActivityEventListener() {
        override fun onActivityResult(activity: Activity?, requestCode: Int, resultCode: Int, data: Intent?) {
            if (requestCode == VPN_REQUEST_CODE) {
                if (resultCode == Activity.RESULT_OK) {
                    startVpnService()
                    pendingPromise?.resolve("CONNECTED")
                } else {
                    pendingPromise?.reject("VPN_PERMISSION_DENIED", "User denied VPN permission")
                }
                pendingPromise = null
            }
        }
    }

    init {
        reactContext.addActivityEventListener(activityEventListener)
    }

    override fun getName(): String {
        return "AliCncVpnModule"
    }

    @ReactMethod
    fun startVpn(promise: Promise) {
        val activity = currentActivity
        if (activity == null) {
            promise.reject("NO_ACTIVITY", "Activity is null")
            return
        }

        val intent = VpnService.prepare(reactApplicationContext)
        if (intent != null) {
            pendingPromise = promise
            activity.startActivityForResult(intent, VPN_REQUEST_CODE)
        } else {
            startVpnService()
            promise.resolve("CONNECTED")
        }
    }

    @ReactMethod
    fun stopVpn(promise: Promise) {
        val intent = Intent(reactApplicationContext, AliCncVpnService::class.java)
        intent.action = "STOP"
        reactApplicationContext.startService(intent)
        promise.resolve("DISCONNECTED")
    }

    private fun startVpnService() {
        val intent = Intent(reactApplicationContext, AliCncVpnService::class.java)
        reactApplicationContext.startService(intent)
    }
}
