using System;
using System.IO;
using System.Text.Json;
using System.Windows;
using System.Windows.Input;
using Microsoft.Web.WebView2.Core;

namespace VoiceChat.Client
{
    public partial class MainWindow : Window
    {
        private readonly GlobalKeyboardHook _keyboardHook;
        private bool _isPttPressed = false;
        
        // Varsayılan Bas-Konuş tuşu: Sol Ctrl (Virtual Key Code: 162)
        private int _pttVirtualKeyCode = 162; 

        public MainWindow()
        {
            InitializeComponent();
            
            _keyboardHook = new GlobalKeyboardHook();
            _keyboardHook.KeyDown += OnGlobalKeyDown;
            _keyboardHook.KeyUp += OnGlobalKeyUp;
            
            Loaded += MainWindow_Loaded;
            Closed += MainWindow_Closed;
        }

        private async void MainWindow_Loaded(object sender, RoutedEventArgs e)
        {
            try
            {
                // Her istemci için benzersiz bir profil klasörü (User Data Folder) oluşturuyoruz.
                // Bu sayede aynı bilgisayarda birden fazla istemci açıldığında Chromium profilleri çakışmaz,
                // kilitlenmeler ve ses motorunun bloke olması engellenir.
                string uniqueUserDataFolder = Path.Combine(Path.GetTempPath(), "VoiceChatClient_" + Guid.NewGuid().ToString("N"));
                var options = new CoreWebView2EnvironmentOptions(
                    additionalBrowserArguments: "--disable-features=WebRtcHideLocalIpsWithMdns"
                );
                var environment = await CoreWebView2Environment.CreateAsync(null, uniqueUserDataFolder, options);
                await webView.EnsureCoreWebView2Async(environment);

                // Local dosyaları yüklemek için sanal host eşlemesi yapıyoruz.
                // Bu sayede WebRTC'nin HTTPS veya localhost zorunluluğunu aşmış oluyoruz.
                string wwwrootPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "wwwroot");
                
                // Klasör yoksa oluştur
                if (!Directory.Exists(wwwrootPath))
                {
                    Directory.CreateDirectory(wwwrootPath);
                }

                webView.CoreWebView2.SetVirtualHostNameToFolderMapping(
                    "localhost",
                    wwwrootPath,
                    CoreWebView2HostResourceAccessKind.Allow
                );

                // Web sayfasını yükle
                webView.Source = new Uri("http://localhost/index.html");

                // JavaScript'ten gelen mesajları dinle
                webView.CoreWebView2.WebMessageReceived += OnWebMessageReceived;

                // Klavye dinleyicisini başlat
                _keyboardHook.Hook();
            }
            catch (Exception ex)
            {
                MessageBox.Show($"WebView2 başlatılırken hata oluştu: {ex.Message}\nLütfen bilgisayarınızda WebView2 Runtime kurulu olduğundan emin olun.", "Hata", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        private void OnGlobalKeyDown(object? sender, GlobalKeyEventArgs e)
        {
            if (e.VirtualKeyCode == _pttVirtualKeyCode)
            {
                if (!_isPttPressed)
                {
                    _isPttPressed = true;
                    SendToJs("ptt_state", new { active = true });
                }
            }
        }

        private void OnGlobalKeyUp(object? sender, GlobalKeyEventArgs e)
        {
            if (e.VirtualKeyCode == _pttVirtualKeyCode)
            {
                _isPttPressed = false;
                SendToJs("ptt_state", new { active = false });
            }
        }

        private void OnWebMessageReceived(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
        {
            try
            {
                string jsonString = e.TryGetWebMessageAsString();
                var message = JsonSerializer.Deserialize<WebMessage>(jsonString);
                
                if (message != null)
                {
                    switch (message.Action)
                    {
                        case "set_ptt_key":
                            // JS'ten yeni tuş ataması geldiğinde sanal tuş kodunu güncelle
                            if (message.Data is JsonElement element && element.TryGetInt32(out int newKey))
                            {
                                _pttVirtualKeyCode = newKey;
                            }
                            break;
                            
                        case "log":
                            Console.WriteLine($"[JS Log] {message.Data}");
                            break;
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Mesaj işleme hatası: {ex.Message}");
            }
        }

        private void SendToJs(string action, object data)
        {
            if (webView.CoreWebView2 != null)
            {
                var payload = JsonSerializer.Serialize(new { action = action, data = data });
                webView.CoreWebView2.PostWebMessageAsString(payload);
            }
        }

        private void MainWindow_Closed(object? sender, EventArgs e)
        {
            _keyboardHook.Unhook();
            _keyboardHook.Dispose();
        }
    }

    public class WebMessage
    {
        public string Action { get; set; } = string.Empty;
        public object? Data { get; set; }
    }
}