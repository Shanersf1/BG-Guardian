package com.bgguardianlink.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

import java.util.Timer;
import java.util.TimerTask;

public class BackgroundService extends Service {

    public static final String CHANNEL_ID = "BackgroundServiceChannel";
    private Timer timer;
    private final Handler handler = new Handler(Looper.getMainLooper());

    @Override
    public void onCreate() {
        super.onCreate();
        timer = new Timer();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        createNotificationChannel();
        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("BG Guardian is running")
                .setContentText("Monitoring your glucose levels in the background.")
                .setSmallIcon(R.mipmap.ic_launcher) // Make sure you have this icon
                .build();

        startForeground(1, notification);

        // Schedule a task to run every 5 minutes
        timer.schedule(new TimerTask() {
            @Override
            public void run() {
                handler.post(() -> {
                    // Get the MainActivity instance to access the WebView
                    MainActivity activity = MainActivity.getMainActivityInstance();
                    if (activity != null) {
                        activity.getBridge().getWebView().evaluateJavascript("window.dispatchEvent(new Event('fetch-bg-data'))", null);
                    }
                });
            }
        }, 0, 5 * 60 * 1000); // 5 minutes

        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (timer != null) {
            timer.cancel();
        }
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel serviceChannel = new NotificationChannel(
                    CHANNEL_ID,
                    "Background Service Channel",
                    NotificationManager.IMPORTANCE_DEFAULT
            );
            NotificationManager manager = getSystemService(NotificationManager.class);
            manager.createNotificationChannel(serviceChannel);
        }
    }
}
