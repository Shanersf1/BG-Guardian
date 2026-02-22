package com.bgguardianlink.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.PowerManager;

public class AlarmReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        // Acquire a wake lock to ensure the CPU doesn't sleep while we're processing
        PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
        PowerManager.WakeLock wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "BGGuardian::AlarmWakeLock");
        wakeLock.acquire(60 * 1000L /* 1 minute timeout */);

        MainActivity activity = MainActivity.getMainActivityInstance();
        if (activity != null) {
            activity.getBridge().getWebView().post(() -> {
                activity.getBridge().getWebView().evaluateJavascript("window.dispatchEvent(new Event('fetch-bg-data'))", null);
            });
        }

        // Schedule the next alarm. This is crucial for repeating.
        BackgroundService.scheduleNextAlarm(context);

        // Release the wake lock once the work is done
        wakeLock.release();
    }
}
