package com.munazzar.plotline;
class WakeLoop { interface Cb { void heard(String cmd); void wake(); void partial(String s); void state(String s); }
 static android.content.Context mc; WakeLoop(android.content.Context c, Cb cb) {} void config(String n, String l, boolean cl) {} void setPaused(boolean p) {} void start() {} void stop() {}
 static void unmute() {} static boolean onDeviceAvailable(android.content.Context c) { return false; } }
