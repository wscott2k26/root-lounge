package com.stormandme.rootlounge;

import android.Manifest;
import android.app.Activity;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.provider.Settings;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import java.util.Set;

public final class MainActivity extends Activity {
    private static final String HOME_URL = "https://root-lounge.vercel.app/";
    private static final Set<String> ALLOWED_HOSTS = Set.of("root-lounge.vercel.app", "rootlounge.app");
    private static final String CHANNEL_ID = "root_lounge_updates";
    private WebView webView;
    private TextView status;
    private ConnectivityManager connectivityManager;
    private final ConnectivityManager.NetworkCallback networkCallback = new ConnectivityManager.NetworkCallback() {
        @Override public void onAvailable(Network network) { updateNetwork(true); }
        @Override public void onLost(Network network) { updateNetwork(isOnline()); }
        @Override public void onCapabilitiesChanged(Network network, NetworkCapabilities caps) {
            updateNetwork(caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET));
        }
    };

    @Override protected void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(Color.rgb(10, 20, 28));
        getWindow().setNavigationBarColor(Color.rgb(10, 20, 28));
        createNotificationChannel();
        buildUi();
        configureWebView();
        connectivityManager = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
        connectivityManager.registerDefaultNetworkCallback(networkCallback);
        updateNetwork(isOnline());
        if (state == null) webView.loadUrl(HOME_URL); else webView.restoreState(state);
    }

    private void buildUi() {
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.rgb(7, 16, 22));

        status = new TextView(this);
        status.setText("Root Lounge • checking connection");
        status.setTextColor(Color.WHITE);
        status.setTextSize(12f);
        status.setGravity(Gravity.CENTER_VERTICAL);
        status.setPadding(dp(14), dp(7), dp(14), dp(7));
        status.setBackgroundColor(Color.rgb(14, 35, 44));
        root.addView(status, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        webView = new WebView(this);
        root.addView(webView, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));

        LinearLayout nativeBar = new LinearLayout(this);
        nativeBar.setGravity(Gravity.CENTER);
        nativeBar.setPadding(dp(8), dp(6), dp(8), dp(8));
        nativeBar.setBackgroundColor(Color.rgb(10, 20, 28));
        nativeBar.addView(action("Share", v -> shareCurrent()), buttonParams());
        nativeBar.addView(action("Buzz", v -> haptic()), buttonParams());
        nativeBar.addView(action("Refresh", v -> webView.reload()), buttonParams());
        root.addView(nativeBar, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        setContentView(root);
    }

    private LinearLayout.LayoutParams buttonParams() {
        LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(0, dp(44), 1f);
        p.setMargins(dp(4), 0, dp(4), 0);
        return p;
    }

    private Button action(String label, View.OnClickListener listener) {
        Button b = new Button(this);
        b.setText(label);
        b.setAllCaps(false);
        b.setOnClickListener(listener);
        return b;
    }

    @SuppressWarnings("SetJavaScriptEnabled")
    private void configureWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        webView.setBackgroundColor(Color.rgb(7, 16, 22));
        webView.addJavascriptInterface(new RootBridge(), "RootNative");
        webView.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String host = uri.getHost();
                if ("https".equalsIgnoreCase(uri.getScheme()) && host != null && ALLOWED_HOSTS.contains(host)) return false;
                openExternal(uri);
                return true;
            }

            @Override public void onPageFinished(WebView view, String url) {
                String js = "window.dispatchEvent(new CustomEvent('rootnative',{detail:{platform:'android',online:" + isOnline() + "}}));";
                view.evaluateJavascript(js, null);
            }
        });
    }

    private void openExternal(Uri uri) {
        try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); }
        catch (Exception e) { Toast.makeText(this, "No app can open this link.", Toast.LENGTH_SHORT).show(); }
    }

    private void shareCurrent() {
        String url = webView.getUrl() == null ? HOME_URL : webView.getUrl();
        Intent share = new Intent(Intent.ACTION_SEND);
        share.setType("text/plain");
        share.putExtra(Intent.EXTRA_TEXT, "Root Lounge — " + url);
        startActivity(Intent.createChooser(share, "Share from Root Lounge"));
    }

    private void haptic() {
        Vibrator vibrator = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
        if (vibrator == null || !vibrator.hasVibrator()) return;
        if (Build.VERSION.SDK_INT >= 26) vibrator.vibrate(VibrationEffect.createOneShot(35, VibrationEffect.DEFAULT_AMPLITUDE));
        else vibrator.vibrate(35);
    }

    private boolean isOnline() {
        if (connectivityManager == null) connectivityManager = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
        Network network = connectivityManager.getActiveNetwork();
        NetworkCapabilities caps = network == null ? null : connectivityManager.getNetworkCapabilities(network);
        return caps != null && caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET);
    }

    private void updateNetwork(boolean online) {
        runOnUiThread(() -> {
            if (status != null) status.setText(online ? "Root Lounge • online" : "Root Lounge • offline — reconnecting…");
            if (webView != null) webView.evaluateJavascript("window.dispatchEvent(new CustomEvent('rootnetwork',{detail:{online:" + online + "}}));", null);
        });
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "Root Lounge updates", NotificationManager.IMPORTANCE_DEFAULT);
            channel.setDescription("Community and conversation updates from Root Lounge");
            ((NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE)).createNotificationChannel(channel);
        }
    }

    private void localNotify(String title, String body) {
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 41);
            return;
        }
        Intent intent = new Intent(this, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pending = PendingIntent.getActivity(this, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        android.app.Notification.Builder builder = Build.VERSION.SDK_INT >= 26
            ? new android.app.Notification.Builder(this, CHANNEL_ID)
            : new android.app.Notification.Builder(this);
        builder.setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(title == null || title.isBlank() ? "Root Lounge" : title)
            .setContentText(body == null ? "You have a Root Lounge update." : body)
            .setAutoCancel(true)
            .setContentIntent(pending);
        ((NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE)).notify((int) (System.currentTimeMillis() & 0xfffffff), builder.build());
    }

    public final class RootBridge {
        @JavascriptInterface public void share() { runOnUiThread(MainActivity.this::shareCurrent); }
        @JavascriptInterface public void haptic() { runOnUiThread(MainActivity.this::haptic); }
        @JavascriptInterface public void notify(String title, String body) { runOnUiThread(() -> localNotify(title, body)); }
        @JavascriptInterface public String platform() { return "android"; }
    }

    @Override protected void onSaveInstanceState(Bundle outState) {
        webView.saveState(outState);
        super.onSaveInstanceState(outState);
    }

    @Override public void onBackPressed() {
        if (webView.canGoBack()) webView.goBack(); else super.onBackPressed();
    }

    @Override protected void onDestroy() {
        if (connectivityManager != null) {
            try { connectivityManager.unregisterNetworkCallback(networkCallback); } catch (Exception ignored) { }
        }
        if (webView != null) webView.destroy();
        super.onDestroy();
    }

    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }
}
