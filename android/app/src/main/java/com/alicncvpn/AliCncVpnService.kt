package com.alicncvpn

import android.content.Intent
import android.net.VpnService
import android.os.ParcelFileDescriptor

class AliCncVpnService : VpnService() {
    private var vpnInterface: ParcelFileDescriptor? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent != null && "STOP" == intent.action) {
            stopVpn()
            return START_NOT_STICKY
        }
        startVpn()
        return START_STICKY
    }

    private fun startVpn() {
        try {
            if (vpnInterface == null) {
                val builder = Builder()
                builder.setSession("Ali CNC VPN")
                       .setMtu(1500)
                       .addAddress("172.19.0.1", 30)
                       .addRoute("0.0.0.0", 0)
                       .addDnsServer("1.1.1.1")
                       .addDnsServer("8.8.8.8")
                
                vpnInterface = builder.establish()
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun stopVpn() {
        try {
            vpnInterface?.close()
            vpnInterface = null
        } catch (e: Exception) {
            e.printStackTrace()
        }
        stopSelf()
    }

    override fun onDestroy() {
        stopVpn()
        super.onDestroy()
    }
}
