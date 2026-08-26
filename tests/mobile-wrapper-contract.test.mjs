import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('Android wrapper has stable identity and native capabilities', () => {
  const gradle = read('mobile/android/app/build.gradle');
  const manifest = read('mobile/android/app/src/main/AndroidManifest.xml');
  const activity = read('mobile/android/app/src/main/java/com/stormandme/rootlounge/MainActivity.java');
  assert.match(gradle, /namespace ['"]com\.stormandme\.rootlounge['"]/);
  assert.match(gradle, /applicationId ['"]com\.stormandme\.rootlounge['"]/);
  assert.match(gradle, /targetSdk 36/);
  assert.match(manifest, /android\.permission\.INTERNET/);
  assert.match(activity, /root-lounge\.vercel\.app/);
  assert.match(activity, /ACTION_SEND/);
  assert.match(activity, /Vibrator|VibrationEffect/);
  assert.match(activity, /ConnectivityManager/);
  assert.match(activity, /NotificationManager/);
  assert.match(activity, /addJavascriptInterface/);
});

test('iOS wrapper has stable identity and native capabilities', () => {
  const project = read('mobile/ios/project.yml');
  const app = read('mobile/ios/RootLounge/AppDelegate.swift');
  assert.match(project, /PRODUCT_BUNDLE_IDENTIFIER: com\.stormandme\.rootlounge/);
  assert.match(app, /root-lounge\.vercel\.app/);
  assert.match(app, /WKWebView/);
  assert.match(app, /UIActivityViewController/);
  assert.match(app, /UIImpactFeedbackGenerator/);
  assert.match(app, /NWPathMonitor/);
  assert.match(app, /UNUserNotificationCenter/);
  assert.match(app, /scriptMessageHandler/);
});

test('mobile CI compiles both wrappers and runtime-smokes Android and iOS', () => {
  const workflow = read('.github/workflows/root-mobile-release.yml');
  assert.match(workflow, /android-emulator-runner/);
  assert.match(workflow, /xcodebuild/);
  assert.match(workflow, /simctl/);
  assert.match(workflow, /node --test tests\/mobile-wrapper-contract\.test\.mjs/);
});
