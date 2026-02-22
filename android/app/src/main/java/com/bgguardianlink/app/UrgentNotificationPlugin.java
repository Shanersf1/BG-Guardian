package com.bgguardianlink.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "UrgentNotification")
public class UrgentNotificationPlugin extends Plugin {

    private static final String CHANNEL_ID = MainActivity.ALERT_CHANNEL_ID;
    private static final int BASE_NOTIFICATION_ID = 9000;

    @PluginMethod
    public void show(PluginCall call) {
        String title = call.getString("title", "BG Alert");
        String body = call.getString("body", "");
        Integer id = call.getInt("id", 1);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            ensureChannelExists();
        }

        Intent fullScreenIntent = new Intent(getContext(), MainActivity.class);
        fullScreenIntent.setAction(Intent.ACTION_MAIN);
        fullScreenIntent.addCategory(Intent.CATEGORY_LAUNCHER);
        fullScreenIntent.setFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK
                        | Intent.FLAG_ACTIVITY_CLEAR_TOP
                        | Intent.FLAG_ACTIVITY_SINGLE_TOP
        );

        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            flags |= PendingIntent.FLAG_MUTABLE;
        }
        PendingIntent fullScreenPendingIntent = PendingIntent.getActivity(
                getContext(),
                BASE_NOTIFICATION_ID + id,
                fullScreenIntent,
                flags
        );

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            getActivity().setShowWhenLocked(true);
            getActivity().setTurnScreenOn(true);
        }

        NotificationCompat.Builder builder = new NotificationCompat.Builder(getContext(), CHANNEL_ID)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle(title)
                .setContentText(body)
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setAutoCancel(true)
                .setOnlyAlertOnce(false)
                .setFullScreenIntent(fullScreenPendingIntent, true)
                .setContentIntent(fullScreenPendingIntent)
                .setDefaults(Notification.DEFAULT_ALL)
                .setVibrate(new long[]{0, 500, 200, 500});

        Notification notification = builder.build();

        NotificationManagerCompat nm = NotificationManagerCompat.from(getContext());
        nm.notify(BASE_NOTIFICATION_ID + id, notification);

        call.resolve();
    }

    private void ensureChannelExists() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Urgent Glucose Alerts",
                    NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("Critical glucose alerts that wake the phone and show on lock screen.");
            channel.setBypassDnd(true);
            channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            channel.enableVibration(true);
            channel.setVibrationPattern(new long[]{0, 500, 200, 500});

            NotificationManager manager = getContext().getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }
}
