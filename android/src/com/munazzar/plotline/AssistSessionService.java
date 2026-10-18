package com.munazzar.plotline;

import android.os.Bundle;
import android.service.voice.VoiceInteractionSession;
import android.service.voice.VoiceInteractionSessionService;

public class AssistSessionService extends VoiceInteractionSessionService {
    @Override
    public VoiceInteractionSession onNewSession(Bundle args) {
        return new VoiceInteractionSession(this) {
            @Override
            public void onShow(Bundle a, int flags) {
                super.onShow(a, flags);
                android.content.Intent i = new android.content.Intent(getContext(), AssistEntry.class);
                try { startAssistantActivity(i); }
                catch (Exception e) {
                    try { i.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK); getContext().startActivity(i); } catch (Exception e2) {}
                }
                hide();
            }
        };
    }
}
