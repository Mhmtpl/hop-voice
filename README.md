# Hop - Real-time P2P Voice & Video Chat Client & Server 🎙️📺

**Hop** is a lightweight, real-time voice, video, and screen-sharing desktop application designed as a modern Discord/Teams alternative. It is highly optimized for gamers and remote teams, providing low-latency peer-to-peer (P2P) communication with a premium glassmorphic user interface.

It utilizes **WebRTC** for direct media transmission, **ASP.NET Core SignalR** for real-time signaling, and a native **WPF** wrapper for global hotkey intercepting and floating overlay mode.

---

## ✨ Features

- 🔊 **WebRTC P2P Voice Chat:** Ultra low-latency peer-to-peer audio transmission with adaptive status monitoring.
- 📹 **Video Conferencing:** Built-in web camera sharing with smart grid alignments and layout size caps to prevent UI stretching.
- 🖥️ **Screen Sharing:** High-framerate screenshare streams synced at the WebRTC track level.
- 🎙️ **Push-to-Talk (PTT) & Open Mic:** Global hotkey hook captures keyboard states even in fullscreen games. Easily customize PTT shortcuts via the left sidebar.
- 💬 **In-Room Text Chat:** Real-time text chat supporting image pasting, file drag-and-drop, and dynamic image compression before sending.
- 🔔 **Floating Toast Notifications:** Premium glassmorphic alerts for error states and success logs, keeping the chat history clean from system notices.
- 📌 **Minimizable Overlay Mode:** Minimizing the window transforms the client into a compact floating bar that overlays games/applications, showing mic status and live speaker listings on hover.

---

## 🛠️ Technology Stack

### Client (Desktop Application)
- **C# .NET 10.0 WPF & XAML:** Native Windows wrapper, borderless frosted-glass custom UI overlay.
- **Microsoft WebView2:** Embeds modern HTML5/CSS3 and JS interface.
- **WebRTC APIs:** Peer-to-peer direct audio & video streaming (low latency, high performance).
- **Web Audio API (OscillatorNode):** Dynamically synthesizes chime sound effects for join/leave notifications (zero audio file dependencies).
- **Global Keyboard Hooks (Win32 APIs):** Captures PTT hotkeys globally across Windows.

### Backend (Signaling Server)
- **ASP.NET Core 10.0 Web API:** Lightweight microservice hosting the signaling hub.
- **SignalR Hub:** Real-time signaling gateway to establish peer-to-peer WebRTC negotiations.

---

## 🚀 How to Run & Setup

### Prerequisites
- [.NET 10.0 SDK](https://dotnet.microsoft.com/download) installed on your computer.

### 1. Run the Signaling Server
Navigate to the server directory and run the project:
```bash
cd src/Services/VoiceChatService
dotnet run
```
By default, the server will start listening on `http://localhost:5000`.

### 2. Run the Desktop Client
Navigate to the client directory and run the project:
```bash
cd src/Clients/VoiceChat.Client
dotnet run
```

1. On the login screen, enter the **Server URL** (e.g. `http://localhost:5000`), your **Username**, and the **Room Name**.
2. Click **Connect**.
3. Select your Microphone and Speaker from the left sidebar devices panel.
4. Toggle between **Bas-Konuş (PTT)** or **Open Mic** mode in the sidebar, and press **Değiştir (Change)** to set your custom hotkey.
5. Minimize the window to automatically enter **Overlay Mode** (floating bar with mute, deafen, disconnect controls and hover member list).
