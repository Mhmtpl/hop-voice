using System;
using System.IO;
using System.Text.Json;
using System.Windows;
using System.Windows.Input;
using System.Windows.Media.Imaging;
using Microsoft.Web.WebView2.Core;

namespace VoiceChat.Client
{
    public partial class MainWindow : Window
    {
        private readonly GlobalKeyboardHook _keyboardHook;
        private bool _isPttPressed = false;
        private OverlayWindow? _overlayWindow;
        private bool _isConnected = false;
        private string _currentRoom = "Genel";
        
        // Varsayılan Bas-Konuş tuşu: Sol Ctrl (Virtual Key Code: 162)
        private int _pttVirtualKeyCode = 162; 
        private string _pttKeyName = "Sol Ctrl";
        private string[] _currentMembers = Array.Empty<string>();

        public MainWindow()
        {
            InitializeComponent();
            
            _keyboardHook = new GlobalKeyboardHook();
            _keyboardHook.KeyDown += OnGlobalKeyDown;
            _keyboardHook.KeyUp += OnGlobalKeyUp;
            
            Loaded += MainWindow_Loaded;
            Closed += MainWindow_Closed;

            // Pencere başlık ikonunu disk yolundan yükle
            try
            {
                string iconPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "wwwroot", "logo.ico");
                if (File.Exists(iconPath))
                {
                    this.Icon = BitmapFrame.Create(new Uri(iconPath, UriKind.Absolute));
                }
            }
            catch { /* İkon yüklenemezse sessizce devam et */ }
        }

        protected override void OnStateChanged(EventArgs e)
        {
            if (this.WindowState == WindowState.Minimized)
            {
                EnterOverlayMode();
            }
            base.OnStateChanged(e);
        }

        private void EnterOverlayMode()
        {
            if (!_isConnected) return; // Bağlı değilsek yüzer bara geçme, normal simge durumuna küçül

            try
            {
                this.Hide();
                if (_overlayWindow == null)
                {
                    _overlayWindow = new OverlayWindow(this, _currentRoom, _pttKeyName);
                    _overlayWindow.Closed += (s, ev) =>
                    {
                        _overlayWindow = null;
                        // Overlay beklenmedik şekilde kapanırsa ana pencereyi geri getir
                        if (!this.IsVisible)
                        {
                            this.Show();
                            this.WindowState = WindowState.Normal;
                            this.Activate();
                        }
                    };
                }
                _overlayWindow.Show();
                _overlayWindow.UpdateMemberList(_currentMembers);
                SendToJs("get_states", null);
            }
            catch
            {
                // Overlay oluşturulamazsa ana pencereyi geri getir
                this.Show();
                this.WindowState = WindowState.Normal;
            }
        }

        public void ToggleMuteFromOverlay()
        {
            SendToJs("toggle_mute", null);
        }

        public void ToggleDeafenFromOverlay()
        {
            SendToJs("toggle_deafen", null);
        }

        public void RestoreFromOverlay()
        {
            if (_overlayWindow != null)
            {
                _overlayWindow.Close();
                _overlayWindow = null;
            }
            this.Show();
            this.WindowState = WindowState.Normal;
            this.Activate();
        }

        public void DisconnectFromOverlay()
        {
            SendToJs("disconnect", null);
            RestoreFromOverlay();
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
                var environment = await CoreWebView2Environment.CreateAsync(null!, uniqueUserDataFolder, options);
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

                // WebView2 izin taleplerini (Mikrofon, Kamera, Ekran Paylaşımı) otomatik onayla
                webView.CoreWebView2.PermissionRequested += (s, args) =>
                {
                    if (args.PermissionKind == CoreWebView2PermissionKind.Microphone ||
                        args.PermissionKind == CoreWebView2PermissionKind.Camera)
                    {
                        args.State = CoreWebView2PermissionState.Allow;
                        args.Handled = true;
                    }
                };

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
                    SendToJs("log", $"[C# Hook] Bas-Konuş Tuşuna BASILDI (VK: {e.VirtualKeyCode})");
                    SendToJs("ptt_state", new { active = true });
                }
            }
        }

        private void OnGlobalKeyUp(object? sender, GlobalKeyEventArgs e)
        {
            if (e.VirtualKeyCode == _pttVirtualKeyCode)
            {
                _isPttPressed = false;
                SendToJs("log", $"[C# Hook] Bas-Konuş Tuşu BIRAKILDI (VK: {e.VirtualKeyCode})");
                SendToJs("ptt_state", new { active = false });
            }
        }

        private void OnWebMessageReceived(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
        {
            try
            {
                string jsonString = e.WebMessageAsJson;
                var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
                var message = JsonSerializer.Deserialize<WebMessage>(jsonString, options);
                
                if (message != null)
                {
                    switch (message.Action)
                    {
                        case "set_ptt_key":
                            if (message.Data != null)
                            {
                                int newKey = 0;
                                string keyName = "Sol Ctrl";
                                if (message.Data is JsonElement element)
                                {
                                    if (element.ValueKind == JsonValueKind.Object)
                                    {
                                        if (element.TryGetProperty("vkCode", out var vkProp) && vkProp.TryGetInt32(out int vkVal))
                                        {
                                            newKey = vkVal;
                                        }
                                        if (element.TryGetProperty("keyName", out var nameProp))
                                        {
                                            keyName = nameProp.GetString() ?? "Bilinmeyen";
                                        }
                                    }
                                    else if (element.ValueKind == JsonValueKind.Number && element.TryGetInt32(out int val))
                                    {
                                        newKey = val;
                                    }
                                }
                                else
                                {
                                    try { newKey = Convert.ToInt32(message.Data); } catch { }
                                }
                                
                                if (newKey != 0)
                                {
                                    _pttVirtualKeyCode = newKey;
                                    _pttKeyName = keyName;
                                    SendToJs("log", $"[C# Host] Bas-Konuş tuşu başarıyla güncellendi: VK {newKey} ({keyName})");
                                    _overlayWindow?.UpdatePttKey(keyName);
                                }
                            }
                            break;

                        case "member_list":
                            if (message.Data is JsonElement memberElement && memberElement.ValueKind == JsonValueKind.Array)
                            {
                                var list = new System.Collections.Generic.List<string>();
                                foreach (var item in memberElement.EnumerateArray())
                                {
                                    list.Add(item.GetString() ?? "");
                                }
                                _currentMembers = list.ToArray();
                                _overlayWindow?.UpdateMemberList(_currentMembers);
                            }
                            break;

                        case "connection_state":
                            if (message.Data is JsonElement connElement && connElement.TryGetProperty("connected", out var connProp))
                            {
                                _isConnected = connProp.GetBoolean();
                                if (connElement.TryGetProperty("room", out var roomProp))
                                {
                                    _currentRoom = roomProp.GetString() ?? "Genel";
                                    _overlayWindow?.UpdateRoomName(_currentRoom);
                                }
                            }
                            break;

                        case "state_changed":
                            if (message.Data is JsonElement stateElement)
                            {
                                bool isMuted = false;
                                bool isDeafened = false;
                                if (stateElement.TryGetProperty("isMuted", out var muteProp))
                                {
                                    isMuted = muteProp.GetBoolean();
                                }
                                if (stateElement.TryGetProperty("isDeafened", out var deafenedProp))
                                {
                                    isDeafened = deafenedProp.GetBoolean();
                                }
                                _overlayWindow?.UpdateStates(isMuted, isDeafened);
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

        private void SendToJs(string action, object? data)
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
        [System.Text.Json.Serialization.JsonPropertyName("action")]
        public string Action { get; set; } = string.Empty;

        [System.Text.Json.Serialization.JsonPropertyName("data")]
        public object? Data { get; set; }
    }
}