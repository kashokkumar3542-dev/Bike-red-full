import fs from 'fs';
import path from 'path';

const root = process.cwd();
const androidDir = path.join(root, 'android');

if (!fs.existsSync(androidDir)) {
  console.error('Android project directory not found. Run "npx cap add android" first.');
  process.exit(1);
}

const versionCode = Number.parseInt(process.env.APP_VERSION_CODE || '1', 10) || 1;
const versionName = (process.env.APP_VERSION_NAME || '1.0.0').replace(/[^0-9A-Za-z._-]/g, '');

// 1. Patch AndroidManifest.xml (hardware acceleration + vibrate permission for collision haptics)
const manifestPath = path.join(androidDir, 'app/src/main/AndroidManifest.xml');
if (fs.existsSync(manifestPath)) {
  let manifest = fs.readFileSync(manifestPath, 'utf8');

  if (!manifest.includes('android.permission.VIBRATE')) {
    manifest = manifest.replace(
      '</manifest>',
      '    <uses-permission android:name="android.permission.VIBRATE" />\n</manifest>'
    );
  }

  if (!manifest.includes('android:hardwareAccelerated')) {
    manifest = manifest.replace(
      '<application',
      '<application\n        android:hardwareAccelerated="true"'
    );
  }

  fs.writeFileSync(manifestPath, manifest, 'utf8');
  console.log('Configured AndroidManifest.xml');
}

// 2. Patch app/build.gradle (set release versionCode & versionName cleanly)
const buildGradlePath = path.join(androidDir, 'app/build.gradle');
if (fs.existsSync(buildGradlePath)) {
  let gradle = fs.readFileSync(buildGradlePath, 'utf8');
  gradle = gradle.replace(/versionCode\s+\d+/, `versionCode ${versionCode}`);
  gradle = gradle.replace(/versionName\s+"[^"]*"/, `versionName "${versionName}"`);
  fs.writeFileSync(buildGradlePath, gradle, 'utf8');
  console.log(`Configured app/build.gradle (v${versionName}, code ${versionCode})`);
}

// 3. Patch MainActivity.java for fullscreen immersive mobile racing & WebAudio/WebGL support
const mainActivityPath = path.join(
  androidDir,
  'app/src/main/java/com/bikeredpull/game/MainActivity.java'
);
if (fs.existsSync(mainActivityPath)) {
  const immersiveActivity = `package com.bikeredpull.game;

import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebSettings;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Keep screen awake while riding
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        // Enable edge-to-edge immersive fullscreen gaming mode
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        hideSystemBars();
    }

    @Override
    public void onStart() {
        super.onStart();
        if (this.bridge != null && this.bridge.getWebView() != null) {
            WebSettings settings = this.bridge.getWebView().getSettings();
            settings.setMediaPlaybackRequiresUserGesture(false);
            settings.setDomStorageEnabled(true);
            settings.setDatabaseEnabled(true);
        }
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            hideSystemBars();
        }
    }

    private void hideSystemBars() {
        View decorView = getWindow().getDecorView();
        WindowInsetsControllerCompat controller =
            WindowCompat.getInsetsController(getWindow(), decorView);
        if (controller != null) {
            controller.setSystemBarsBehavior(
                WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            );
            controller.hide(WindowInsetsCompat.Type.systemBars());
        }
    }
}
`;
  fs.writeFileSync(mainActivityPath, immersiveActivity, 'utf8');
  console.log('Configured MainActivity.java for immersive fullscreen & WebGL/WebAudio');
}
