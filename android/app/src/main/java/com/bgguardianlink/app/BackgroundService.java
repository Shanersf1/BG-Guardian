package com.bgguardianlink.app;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;
import android.os.SystemClock;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

public class BackgroundService extends Service {

    public static final String CHANNEL_ID = "BackgroundServiceChannel";

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        createNotificationChannel();
        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("BG Guardian is running")
                .setContentText("Monitoring your glucose levels.")
                .setSmallIcon(R.mipmap.ic_launcher)
                .build();

        startForeground(1, notification);

        // Schedule the very first alarm to kick off the cycle.
        scheduleNextAlarm(this);

        return START_STICKY;
    }

    public static void scheduleNextAlarm(Context context) {
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        Intent intent = new Intent(context, AlarmReceiver.class);
        PendingIntent pendingIntent = PendingIntent.getBroadcast(context, 1, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        long interval = 5 * 60 * 1000; // 5 minutes
        long triggerAtMillis = SystemClock.elapsedRealtime() + interval;

        if (alarmManager != null) {
            // Use setExactAndAllowWhileIdle to wake the device even from Doze mode
            alarmManager.setExactAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, triggerAtMillis, pendingIntent);
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
                    "Background Service Status",
                    NotificationManager.IMPORTANCE_LOW // Low importance for the persistent notification
            );
            NotificationManager manager = getSystemService(NotificationManager.class);
            manager.createNotificationChannel(serviceChannel);
        }
    }
}
