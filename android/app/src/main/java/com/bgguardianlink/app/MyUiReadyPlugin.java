package com.bgguardianlink.app;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "MyUiReadyPlugin")
public class MyUiReadyPlugin extends Plugin {

    @PluginMethod
    public void uiIsReady(PluginCall call) {
        MainActivity activity = (MainActivity) getContext();
        if (activity != null) {
            activity.processPendingDataUpdates();
        }
        call.resolve();
    }
}