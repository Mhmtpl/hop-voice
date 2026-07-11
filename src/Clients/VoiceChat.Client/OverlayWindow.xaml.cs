using System;
using System.Windows;
using System.Windows.Input;
using System.Windows.Media;

namespace VoiceChat.Client
{
    public partial class OverlayWindow : Window
    {
        private readonly MainWindow _mainWindow;

        public OverlayWindow(MainWindow mainWindow, string roomName = "Genel", string pttKeyName = "Sol Ctrl")
        {
            InitializeComponent();
            _mainWindow = mainWindow;

            // Oda adını göster
            txtRoomName.Text = roomName;
            txtPttKey.Text = $"PTT: {pttKeyName}";

            // Konumu ekranın sağ alt köşesine ayarla
            double screenWidth = SystemParameters.WorkArea.Width;
            double screenHeight = SystemParameters.WorkArea.Height;
            this.Left = screenWidth - this.Width - 20;
            this.Top = screenHeight - this.Height - 20;
        }

        private void Border_MouseDown(object sender, MouseButtonEventArgs e)
        {
            if (e.LeftButton == MouseButtonState.Pressed)
            {
                this.DragMove();
            }
        }

        // Dışarıdan oda ismini güncellemek için
        public void UpdateRoomName(string roomName)
        {
            Dispatcher.Invoke(() =>
            {
                txtRoomName.Text = roomName;
            });
        }

        // Dışarıdan PTT tuş ismini güncellemek için
        public void UpdatePttKey(string keyName)
        {
            Dispatcher.Invoke(() =>
            {
                txtPttKey.Text = $"PTT: {keyName}";
            });
        }

        // Dışarıdan üye listesini güncellemek için
        public void UpdateMemberList(string[] members)
        {
            Dispatcher.Invoke(() =>
            {
                lstMembers.ItemsSource = members;
            });
        }

        // Dışarıdan mute/deafen durumunu güncellemek için
        public void UpdateStates(bool isMuted, bool isDeafened)
        {
            Dispatcher.Invoke(() =>
            {
                var redBrush = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#EF4444"));
                var whiteBrush = Brushes.White;

                // Mikrofon
                if (isMuted)
                {
                    micPath.Fill = redBrush;
                    micSlash.Visibility = Visibility.Visible;
                    micLabel.Text = "Susturuldu";
                    micLabel.Foreground = redBrush;
                }
                else
                {
                    micPath.Fill = whiteBrush;
                    micSlash.Visibility = Visibility.Collapsed;
                    micLabel.Text = "Mikrofon";
                    micLabel.Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#88FFFFFF"));
                }

                // Kulaklık
                if (isDeafened)
                {
                    deafenPath.Fill = redBrush;
                    deafenSlash.Visibility = Visibility.Visible;
                    deafenLabel.Text = "Sağır";
                    deafenLabel.Foreground = redBrush;
                }
                else
                {
                    deafenPath.Fill = whiteBrush;
                    deafenSlash.Visibility = Visibility.Collapsed;
                    deafenLabel.Text = "Ses";
                    deafenLabel.Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#88FFFFFF"));
                }
            });
        }

        private void RoomInfoPanel_MouseEnter(object sender, MouseEventArgs e)
        {
            memberPopup.IsOpen = true;
        }

        private void RoomInfoPanel_MouseLeave(object sender, MouseEventArgs e)
        {
            memberPopup.IsOpen = false;
        }

        private void MuteButton_Click(object sender, RoutedEventArgs e)
            => _mainWindow.ToggleMuteFromOverlay();

        private void DeafenButton_Click(object sender, RoutedEventArgs e)
            => _mainWindow.ToggleDeafenFromOverlay();

        private void RestoreButton_Click(object sender, RoutedEventArgs e)
            => _mainWindow.RestoreFromOverlay();

        private void DisconnectButton_Click(object sender, RoutedEventArgs e)
            => _mainWindow.DisconnectFromOverlay();
    }
}
