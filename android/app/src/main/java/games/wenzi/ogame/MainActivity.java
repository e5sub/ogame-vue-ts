package games.wenzi.ogame;

import android.graphics.Color;
import android.os.Bundle;
import android.view.Window;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Window window = getWindow();

        // 启用边到边显示（Edge-to-Edge）
        WindowCompat.setDecorFitsSystemWindows(window, false);

        // 设置透明状态栏和导航栏
        window.setStatusBarColor(Color.TRANSPARENT);
        window.setNavigationBarColor(Color.TRANSPARENT);

        // 设置状态栏图标为浅色（因为背景是深色）
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, window.getDecorView());
        if (controller != null) {
            controller.setAppearanceLightStatusBars(false);
            controller.setAppearanceLightNavigationBars(false);
        }
    }

    @Override
    public void onStart() {
        super.onStart();
        WebView webView = getBridge().getWebView();
        if (webView != null) {
            WebSettings settings = webView.getSettings();
            // 禁用 WebView 文本缩放，防止系统字体大小设置影响布局
            settings.setTextZoom(100);
            // 优化 WebView 性能
            settings.setCacheMode(WebSettings.LOAD_DEFAULT);
            settings.setDomStorageEnabled(true);
            settings.setDatabaseEnabled(true);
            // 启用硬件加速渲染
            webView.setLayerType(android.view.View.LAYER_TYPE_HARDWARE, null);
        }
    }
}
