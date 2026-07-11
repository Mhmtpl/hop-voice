# Hop - Real-time P2P Voice Chat Client & Server 🎙️

[Türkçe Rehber için aşağı kaydırın / Scroll down for Turkish Guide]

**Hop** is a lightweight, real-time voice chat desktop application designed as a Discord/Teams alternative for gamers, specifically optimized for seamless communication. It utilizes WebRTC for peer-to-peer audio transmission and ASP.NET Core SignalR for signaling.

---

## 🛠️ Technology Stack (Kullanılan Teknolojiler)

### Client (Masaüstü İstemci)
*   **C# .NET 10.0 WPF & XAML:** Native Windows wrapper, borderless frosted-glass custom UI overlay.
*   **Microsoft WebView2:** Embeds modern HTML5/CSS3 and JS interface.
*   **WebRTC APIs:** Peer-to-peer direct audio streaming (low latency, high performance).
*   **Web Audio API (OscillatorNode):** Dynamically synthesizes chimes for join/leave notifications (zero audio file dependencies).
*   **Global Keyboard Hooks (Win32 APIs):** Captures push-to-talk (PTT) keys globally even when playing games in fullscreen mode.

### Backend (Sinyalleşme Sunucusu)
*   **ASP.NET Core 10.0 Web API:** Lightweight microservice host.
*   **SignalR Hub:** Real-time signaling gateway to establish peer-to-peer WebRTC connections.

---

## 🚀 How to Run & Setup (Kurulum ve Çalıştırma)

### Prerequisites (Gereksinimler)
*   [.NET 10.0 SDK](https://dotnet.microsoft.com/download) installed on your computer.

### 1. Run the Signaling Server (Sunucuyu Çalıştırın)
Navigate to the server directory and run the project:
```bash
cd src/Services/VoiceChatService
dotnet run
```
By default, the server will start listening on `http://localhost:5000`.

### 2. Run the Desktop Client (İstemciyi Çalıştırın)
Navigate to the client directory and run the project:
```bash
cd src/Clients/VoiceChat.Client
dotnet run
```
1. On the login screen, enter the **Server URL** (e.g. `http://localhost:5000`), your **Username**, and the **Room Name**.
2. Click **Connect (Bağlan)**.
3. Minimize the window to automatically enter **Overlay Mode** (floating bar with mute, deafen, disconnect controls and hover member list).

---

# 🇹🇷 Hop - Gerçek Zamanlı P2P Sesli Sohbet Platformu

**Hop**, özellikle oyuncular için optimize edilmiş, gecikmesiz ses aktarımı sağlayan hafif bir sesli sohbet uygulamasıdır. Doğrudan eşler arası (P2P) ses akışı için WebRTC, sinyalleşme için ise ASP.NET Core SignalR teknolojilerini kullanır.

---

## 🚀 Kurulum ve Çalıştırma Adımları

### 1. Sinyalleşme Sunucusunu Başlatma
Sunucu dizinine gidin ve projeyi çalıştırın:
```bash
cd src/Services/VoiceChatService
dotnet run
```
Sunucu varsayılan olarak `http://localhost:5000` portundan yayına başlayacaktır.

### 2. Masaüstü İstemciyi Başlatma
İstemci dizinine gidin ve projeyi çalıştırın:
```bash
cd src/Clients/VoiceChat.Client
dotnet run
```
1. Giriş ekranında **Sunucu Adresi** (Örn: `http://localhost:5000`), **Kullanıcı Adı** ve girmek istediğiniz **Oda İsmi** bilgilerini yazın.
2. **Bağlan** butonuna tıklayın.
3. Uygulamayı simge durumuna küçülterek **Yüzer Panel (Overlay)** moduna geçiş yapabilirsiniz. (Yüzer bar üzerindeki oda adına farenizi getirerek odadaki kişileri canlı olarak listeleyebilirsiniz.)
