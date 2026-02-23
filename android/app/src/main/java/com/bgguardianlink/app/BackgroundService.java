package com.bgguardianlink.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.media.AudioManager;
import android.os.Build;
import android.os.Bundle;
import android.os.IBinder;
import android.speech.tts.TextToSpeech;
import android.util.Log;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

import java.util.Locale;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;

public class BackgroundService extends Service implements TextToSpeech.OnInitListener {

    public static final String CHANNEL_ID = "BackgroundServiceChannel";
    private TextToSpeech tts;
    private ScheduledExecutorService scheduler;
    private final OkHttpClient client = new OkHttpClient();

    @Override
    public void onCreate() {
        super.onCreate();
        tts = new TextToSpeech(this, this);
        createNotificationChannel();
        startHeartbeat();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("BG Guardian is running")
                .setContentText("Monitoring your glucose levels.")
                .setSmallIcon(R.mipmap.ic_launcher)
                .build();

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(1, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
        } else {
            startForeground(1, notification);
        }

        return START_STICKY;
    }

    private void startHeartbeat() {
        scheduler = Executors.newSingleThreadScheduledExecutor();
        // Runs every 5 minutes
        scheduler.scheduleAtFixedRate(() -> {
            try {
                checkServerForUpdates();
            } catch (Exception e) {
                Log.e("Monitor", "Heartbeat failed", e);
            }
        }, 0, 5, TimeUnit.MINUTES);
    }

    private void checkServerForUpdates() throws Exception {
        Request request = new Request.Builder()
                .url("https://bg-guardian-production.up.railway.app:8080/api/readings")
                .build();

        try (Response response = client.newCall(request).execute()) {
            if (response.isSuccessful()) {
                String jsonData = response.body().string();

                if (jsonData.contains("\"alert\":true")) {
                    triggerAlert("Urgent Glucose Alert!");
                }
            }
        }
    }

    private void triggerAlert(String message) {
        if (tts != null) {
            Bundle params = new Bundle();
            params.putInt(TextToSpeech.Engine.KEY_PARAM_STREAM, AudioManager.STREAM_ALARM);
            tts.speak(message, TextToSpeech.QUEUE_FLUSH, params, "BG_ALERT_ID");
        }

        showNotification(message);
    }

    private void showNotification(String text) {
        NotificationManager nm = getSystemService(NotificationManager.class);

        Intent intent = new Intent(this, MainActivity.class);
        intent.setAction(Intent.ACTION_MAIN); // Required for lock screen bypass
        intent.addCategory(Intent.CATEGORY_LAUNCHER); // Required for lock screen bypass
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pi = PendingIntent.getActivity(this, 0, intent,
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);

        Notification notification = new NotificationCompat.Builder(this, "MonitorChannel")
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle("Glucose Monitor")
                .setContentText(text)
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setFullScreenIntent(pi, true)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setDefaults(Notification.DEFAULT_ALL)
                .build();

        nm.notify(2, notification);
    }

    @Override
    public void onInit(int status) {
        if (status == TextToSpeech.SUCCESS) {
            tts.setLanguage(Locale.US);
        }
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        if (tts != null) { tts.stop(); tts.shutdown(); }
        if (scheduler != null) { scheduler.shutdownNow(); }
        super.onDestroy();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel serviceChannel = new NotificationChannel(
                    CHANNEL_ID,
                    "Background Service Status",
                    NotificationManager.IMPORTANCE_LOW
            );
            NotificationManager manager = getSystemService(NotificationManager.class);
            manager.createNotificationChannel(serviceChannel);
        }
    }
}
