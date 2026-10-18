package com.munazzar.plotline;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.os.IBinder;
import org.json.JSONObject;

/* "Keep listening in the background": listens for "Hey Plot" when Plotline isn't on screen.
   Android only allows that from a foreground service of type microphone, started while the app is open,
   with a notification shown the whole time. Its Stop button turns background listening off. */
public class AssistService extends Service {
    static AssistService me;
    static final String CH = "assistant_listen_quiet", OLD_CH = "assistant_listen", STOP = "com.munazzar.plotline.ASSIST_STOP";
    static final int FG_MICROPHONE = 128; // ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE (API 30)
    WakeLoop loop;

    public IBinder onBind(Intent i) { return null; }

    public int onStartCommand(Intent i, int flags, int id) {
        if (i != null && STOP.equals(i.getAction())) {
            try {
                JSONObject o = Assist.cfg(this);
                o.put("bg", false);
                Assist.prefs(this).edit().putString("cfg", o.toString()).putBoolean("bgOff", true).apply();
            } catch (Exception e) {}
            stopSelf();
            Assist.apply(this);
            return START_NOT_STICKY;
        }
        if (!foreground()) { stopSelf(); return START_NOT_STICKY; }
        me = this;
        if (loop == null) {
            final Context c = this;
            loop = new WakeLoop(this, new WakeLoop.Cb() {
                public void heard(String cmd) { Assist.heard(c, cmd); }
                public void wake() { Assist.woke(c); }
                public void partial(String s) { Assist.partial(s); }
                public void state(String s) { Assist.state(s); }
            });
        }
        sync(Assist.jsPause || Assist.ttsPause);
        return START_NOT_STICKY;
    }

    void sync(boolean pause) {
        if (loop == null) return;
        JSONObject o = Assist.cfg(this);
        loop.config(o.optString("name", "Plot"), o.optString("lang", ""), o.optBoolean("cloud"));
        loop.setPaused(pause);
        loop.start();
    }

    boolean foreground() {
        try {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            /* the lowest importance: no sound, no buzz, no status-bar icon, just a quiet line in the shade (Android requires one) */
            NotificationChannel ch = new NotificationChannel(CH, "Listening for the wake word", NotificationManager.IMPORTANCE_MIN);
            ch.setSound(null, null); ch.enableVibration(false); ch.setShowBadge(false);
            nm.createNotificationChannel(ch);
            try { nm.deleteNotificationChannel(OLD_CH); } catch (Exception e) {}
            String name = Assist.cfg(this).optString("name", "Plot");
            PendingIntent open = PendingIntent.getActivity(this, 2952, Assist.open(this, "assistant-listen"), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            PendingIntent stop = PendingIntent.getService(this, 2953, new Intent(this, AssistService.class).setAction(STOP), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            Notification n = new Notification.Builder(this, CH)
                .setSmallIcon(W.id(this, "ic_stat", "drawable")).setColor(0xFFFFB547)
                .setContentTitle("Listening for “Hey " + name + "”")
                .setContentText("Say “Hey " + name + "” any time. Tap to talk now")
                .setContentIntent(open).setOngoing(true).setOnlyAlertOnce(true).setShowWhen(false)
                .addAction(new Notification.Action.Builder(null, "Stop listening", stop).build())
                .build();
            startForeground(2950, n, FG_MICROPHONE);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    public void onDestroy() {
        if (loop != null) loop.stop();
        loop = null;
        if (me == this) me = null;
        super.onDestroy();
    }
}
