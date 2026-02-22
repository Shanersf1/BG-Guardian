package com.bgguardianlink.app;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.provider.Settings;
import android.view.ViewGroup;
import android.webkit.WebSettings;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    public static final String ALERT_CHANNEL_ID = "AlertChannel";
    private static final int NOTIFICATION_PERMISSION_REQUEST_CODE = 101;
    private static MainActivity instance;
    private boolean serviceStarted = false;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        instance = this;

        // --- WebSettings Configuration ---
        this.bridge.getWebView().getSettings().setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        this.bridge.getWebView().getSettings().setMediaPlaybackRequiresUserGesture(false);

        // --- Handle Safe Area Insets ---
        ViewCompat.setOnApplyWindowInsetsListener(this.bridge.getWebView(), (v, insets) -> {
            int top = insets.getInsets(WindowInsetsCompat.Type.systemBars()).top;
            int bottom = insets.getInsets(WindowInsetsCompat.Type.systemBars()).bottom;

            ViewGroup.MarginLayoutParams params = (ViewGroup.MarginLayoutParams) v.getLayoutParams();
            params.topMargin = top;
            params.bottomMargin = bottom;
            v.setLayoutParams(params);

            return insets;
        });

        createNotificationChannels();
        registerPlugin(UrgentNotificationPlugin.class);
    }

    @Override
    public void onResume() {
        super.onResume();
        checkAndRequestPermissions();
    }

    private void checkAndRequestPermissions() {
        if (!hasNotificationPermission()) {
            requestNotificationPermission();
        } else if (!isIgnoringBatteryOptimizations()) {
            requestIgnoreBatteryOptimizations();
        } else if (!canScheduleExactAlarms()) {
            requestExactAlarmPermission();
        } else if (!canUseFullScreenIntent()) {
            requestFullScreenIntentPermission();
        } else {
            if (!serviceStarted) {
                startBackgroundServiceWithDelay();
                serviceStarted = true;
            }
        }
    }

    private boolean canScheduleExactAlarms() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            AlarmManager alarmManager = (AlarmManager) getSystemService(Context.ALARM_SERVICE);
            return alarmManager != null && alarmManager.canScheduleExactAlarms();
        }
        return true;
    }

    private void requestExactAlarmPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            Intent intent = new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM);
            intent.setData(Uri.parse("package:" + getPackageName()));
            startActivity(intent);
        }
    }

    private boolean canUseFullScreenIntent() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            NotificationManager nm = getSystemService(NotificationManager.class);
            return nm != null && nm.canUseFullScreenIntent();
        }
        return true;
    }

    private void requestFullScreenIntentPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            Intent intent = new Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT);
            intent.setData(Uri.parse("package:" + getPackageName()));
            startActivity(intent);
        }
    }

    private boolean hasNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            return ContextCompat.checkSelfPermission(this, android.Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
        } else {
            return true;
        }
    }

    private void requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ActivityCompat.requestPermissions(this, new String[]{android.Manifest.permission.POST_NOTIFICATIONS}, NOTIFICATION_PERMISSION_REQUEST_CODE);
        }
    }

    private boolean isIgnoringBatteryOptimizations() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
            return pm != null && pm.isIgnoringBatteryOptimizations(getPackageName());
        } else {
            return true;
        }
    }

    private void requestIgnoreBatteryOptimizations() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
            intent.setData(Uri.parse("package:" + getPackageName()));
            startActivity(intent);
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        // The onResume() method will handle the logic after the permission is granted or denied.
    }

    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel alertChannel = new NotificationChannel(
                    ALERT_CHANNEL_ID,
                    "Urgent Glucose Alerts",
                    NotificationManager.IMPORTANCE_HIGH
            );
            alertChannel.setDescription("Critical glucose alerts that wake the phone and show on lock screen.");
            alertChannel.setBypassDnd(true);
            alertChannel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            alertChannel.enableVibration(true);
            alertChannel.setVibrationPattern(new long[]{0, 500, 200, 500});

            NotificationManager manager = getSystemService(NotificationManager.class);
            manager.createNotificationChannel(alertChannel);
        }
    }

    private void startBackgroundServiceWithDelay() {
        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            Intent serviceIntent = new Intent(this, BackgroundService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(serviceIntent);
            } else {
                startService(serviceIntent);
            }
        }, 2000); // 2-second delay
    }

    public static MainActivity getMainActivityInstance() {
        return instance;
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        instance = null;
    }
}
