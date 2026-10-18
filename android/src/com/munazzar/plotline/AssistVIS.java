package com.munazzar.plotline;

import android.service.voice.VoiceInteractionService;

/* Lets Plotline be picked as the phone's digital assistant app (Settings › Apps › Default apps), so a long press
   of the side key or home button opens Plot from any app. Holding this role doesn't give "Hey Plot" detection
   with the screen off: that hardware hotword is only for system assistants, so the wake word stays as it is. */
public class AssistVIS extends VoiceInteractionService {
}
