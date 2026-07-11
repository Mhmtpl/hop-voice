using System;
using System.Windows;
using System.Windows.Input;
using System.Windows.Media;

namespace VoiceChat.Client
{
    public partial class OverlayWindow : Window
    {
        private readonly MainWindow _mainWindow;

        public OverlayWindow(MainWindow mainWindow)
        {
            InitializeComponent();
            _mainWindow = mainWindow;
            
            // Konumu ekranın sağ alt köşesine ayarla (System Tray üzeri)
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

        // Dışarıdan durumları güncellemek için çağrılan metot
        public void UpdateStates(bool isMuted, bool isDeafened)
        {
            Dispatcher.Invoke(() =>
            {
                var redBrush = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#EF4444"));
                var whiteBrush = Brushes.White;

                if (isMuted)
                {
                    micPath.Fill = redBrush;
                    micSlash.Visibility = Visibility.Visible;
                }
                else
                {
                    micPath.Fill = whiteBrush;
                    micSlash.Visibility = Visibility.Collapsed;
                }

                if (isDeafened)
                {
                    deafenPath.Fill = redBrush;
                    deafenSlash.Visibility = Visibility.Visible;
                }
                else
                {
                    deafenPath.Fill = whiteBrush;
                    deafenSlash.Visibility = Visibility.Collapsed;
                }
            });
        }

        private void MuteButton_Click(object sender, RoutedEventArgs e)
        {
            _mainWindow.ToggleMuteFromOverlay();
        }

        private void DeafenButton_Click(object sender, RoutedEventArgs e)
        {
            _mainWindow.ToggleDeafenFromOverlay();
        }

        private void RestoreButton_Click(object sender, RoutedEventArgs e)
        {
            _mainWindow.RestoreFromOverlay();
        }

        private void DisconnectButton_Click(object sender, RoutedEventArgs e)
        {
            _mainWindow.DisconnectFromOverlay();
        }
    }
}
