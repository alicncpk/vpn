package com.alicncvpn

import android.app.Activity
import android.content.Intent
import android.net.VpnService
import android.content.ContentValues
import android.provider.MediaStore
import android.os.Environment
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

    @ReactMethod
    fun saveLogsToStorage(logsText: String, promise: Promise) {
        val context = reactApplicationContext
        val resolver = context.contentResolver
        val contentValues = ContentValues().apply {
            put(MediaStore.MediaColumns.DISPLAY_NAME, "AliCncVpn_Logs_${System.currentTimeMillis()}.txt")
            put(MediaStore.MediaColumns.MIME_TYPE, "text/plain")
            put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
        }

        var outputStream: java.io.OutputStream? = null
        try {
            val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, contentValues)
            if (uri != null) {
                outputStream = resolver.openOutputStream(uri)
                outputStream?.write(logsText.toByteArray())
                outputStream?.flush()
                promise.resolve("Logs successfully saved to Downloads folder!")
            } else {
                promise.reject("SAVE_FAILED", "Failed to create MediaStore entry")
            }
        } catch (e: Exception) {
            promise.reject("SAVE_FAILED", e.message, e)
        } finally {
            try {
                outputStream?.close()
            } catch (e: Exception) {}
        }
    }

    private fun startVpnService() {
        val intent = Intent(reactApplicationContext, AliCncVpnService::class.java)
        reactApplicationContext.startService(intent)
    }
}
