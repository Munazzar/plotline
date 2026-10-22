package com.munazzar.plotline;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.widget.RemoteViews;
import java.io.InputStream;

/* Plotlines · Orb: just Plot's orb, any size from one cell up. Tap it and a voice conversation starts over whatever
   is on screen (TalkActivity), without opening the full app.
   The orb slowly swirls and breathes: the layout is a ViewFlipper that cross-fades through FRAMES pictures
   (assets/orb/o00.png…), one every 650 ms. The pictures come from assets so the layout's ImageViews can reuse
   existing ids; each one also shows the still orb on its own, in the widget picker or if a frame can't load. */
public class OrbWidget extends AppWidgetProvider {
    static final String[] FRAMES = {"w_d0", "w_d1", "w_d2", "w_d3", "w_d4", "w_d5", "w_d6", "w_c0", "w_c1", "w_c2", "w_c3", "w_c4", "w_c5", "w_e0", "w_e1", "w_e2"};

    @Override
    public void onUpdate(Context c, AppWidgetManager m, int[] ids) {
        RemoteViews v = new RemoteViews(c.getPackageName(), W.id(c, "widget_orb", "layout"));
        for (int i = 0; i < FRAMES.length; i++) {
            Bitmap b = frame(c, i);
            if (b != null) v.setImageViewBitmap(W.id(c, FRAMES[i]), b);
        }
        v.setOnClickPendingIntent(W.id(c, "orb_root"), talk(c, 2964));
        m.updateAppWidget(ids, v);
    }

    static Bitmap frame(Context c, int i) {
        InputStream in = null;
        try {
            in = c.getAssets().open("orb/o" + (i < 10 ? "0" : "") + i + ".png");
            return BitmapFactory.decodeStream(in);
        } catch (Exception e) {
            return null;
        } finally {
            try { if (in != null) in.close(); } catch (Exception e) {}
        }
    }

    /* the talk overlay; the widget's own request code keeps each widget's PendingIntent apart */
    static PendingIntent talk(Context c, int rq) {
        Intent i = new Intent(c, TalkActivity.class);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(c, rq, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
