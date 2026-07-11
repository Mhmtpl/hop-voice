// HTML Elementleri
const loginScreen = document.getElementById('login-screen');
const mainScreen = document.getElementById('main-screen');
const btnConnect = document.getElementById('btn-connect');
const btnMute = document.getElementById('btn-mute');
const btnDisconnect = document.getElementById('btn-disconnect');
const btnChangeKey = document.getElementById('btn-change-key');
const inputServerUrl = document.getElementById('server-url');
const inputUsername = document.getElementById('username');
const inputRoomId = document.getElementById('room-id');
const connectionStatus = document.getElementById('connection-status');
const membersList = document.getElementById('members-list');
const myUsernameDisplay = document.getElementById('my-username');
const myAvatarDisplay = document.getElementById('my-avatar');
const activeRoomName = document.getElementById('active-room-name');
const headerRoomName = document.getElementById('header-room-name');
const pttKeyDisplay = document.getElementById('ptt-key-display');
const pttIndicatorCircle = document.getElementById('ptt-indicator-circle');
const micStatusText = document.getElementById('mic-status-text');
const centralMic = document.querySelector('.central-mic');
const audioContainer = document.getElementById('audio-container');

// Mod Seçimi Elementleri
const chkPttMode = document.getElementById('chk-ptt-mode');
const pttSettingsArea = document.getElementById('ptt-settings-area');
const openmicSettingsArea = document.getElementById('openmic-settings-area');

// Global Değişkenler
let connection = null;
let audioCtx = null;
let localStream = null;
let myConnectionId = null;
let myUsername = "";
let currentRoom = "";
let isMuted = false; // Yazılımsal susturma (tıklama ile)
let isPttActive = false; // Bas-konuş tuşunun basılı olma durumu
let isPttMode = true; // Bas-konuş modunun açık olup olmadığı (değilse sürekli açık)
let isListeningForKey = false;

// Peer Connections: ConnectionId -> RTCPeerConnection
const peerConnections = {};
// Remote Streams: ConnectionId -> MediaStream
const remoteStreams = {};
// Audio Elements: ConnectionId -> HTMLAudioElement
const audioElements = {};
// Analysers for Voice Activity Detection: ConnectionId -> AnalyserNode
const audioAnalysers = {};

// WebRTC Yapılandırması (STUN sunucuları bağlantı kurmaya yarar)
const rtcConfig = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};

// C# (WPF Host) İletişimi
function sendToCsharp(action, data) {
    if (window.chrome && window.chrome.webview) {
        window.chrome.webview.postMessage({ action: action, data: data });
    }
}

// C#'tan gelen mesajları yakala
if (window.chrome && window.chrome.webview) {
    window.chrome.webview.addEventListener('message', event => {
        const message = event.data;
        if (message && message.action) {
            handleCsharpMessage(message.action, message.data);
        }
    });
}

function handleCsharpMessage(action, data) {
    switch (action) {
        case 'ptt_state':
            // Bas-konuş tuşunun durumu değişti (active: true/false)
            setPushToTalkState(data.active);
            break;
    }
}

// Giriş Butonu Tıklaması
btnConnect.addEventListener('click', connectToVoiceChat);

// Bağlan Fonksiyonu
async function connectToVoiceChat() {
    const serverUrl = inputServerUrl.value.trim();
    myUsername = inputUsername.value.trim() || "Anonim_" + Math.floor(Math.random() * 1000);
    currentRoom = inputRoomId.value.trim() || "Genel";

    if (!serverUrl) {
        showStatus("Lütfen geçerli bir sunucu adresi girin.", "error");
        return;
    }

    showStatus("Mikrofona erişiliyor...", "info");
    btnConnect.disabled = true;

    try {
        // 1. Kullanıcı mikrofonunu al
        localStream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            }, 
            video: false 
        });

        // Mikrofonu başlangıç moduna göre ayarla (Bas-konuş veya sürekli açık)
        setMicTrackEnabled(!isPttMode);

        // Global AudioContext'i kullanıcı etkileşimi esnasında oluşturup başlatıyoruz.
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') {
            await audioCtx.resume();
        }

        showStatus("Sunucuya bağlanılıyor...", "info");

        // 2. SignalR Bağlantısını Kur
        connection = new signalR.HubConnectionBuilder()
            .withUrl(`${serverUrl}/signaling`)
            .withAutomaticReconnect()
            .build();

        // Sunucu Olayları
        connection.on("UserJoined", async (connectionId) => {
            log(`Kullanıcı katıldı: ${connectionId}`);
            // Yeni gelen kullanıcı için Peer oluştur ve teklif (offer) gönder
            await initiateCall(connectionId);
        });

        connection.on("RoomUsers", async (users) => {
            log(`Odadaki mevcut kullanıcılar: ${JSON.stringify(users)}`);
            // Aramayı biz (yeni katılan) başlatmıyoruz.
            // Odada halihazırda bulunan eski kullanıcılar "UserJoined" uyarısı alınca aramayı bize doğru başlatacaklar.
            // Bu sayede çift taraflı arama çakışması (WebRTC Glare) önlenmiş olur.
        });

        connection.on("ReceiveSignal", async (senderConnectionId, signalJson) => {
            const signal = JSON.parse(signalJson);
            await handleWebRtcSignal(senderConnectionId, signal);
        });

        connection.on("UserLeft", (connectionId) => {
            log(`Kullanıcı ayrıldı: ${connectionId}`);
            closePeerConnection(connectionId);
        });

        // Bağlantıyı Başlat
        await connection.start();
        
        myConnectionId = connection.connectionId;
        log(`SignalR Bağlantısı kuruldu. ID: ${myConnectionId}`);

        // Odaya Katıl
        await connection.invoke("JoinRoom", currentRoom);

        // Arayüzü Güncelle
        myUsernameDisplay.textContent = myUsername;
        myAvatarDisplay.textContent = myUsername.substring(0, 2).toUpperCase();
        activeRoomName.textContent = currentRoom;
        headerRoomName.textContent = currentRoom;

        loginScreen.classList.remove('active');
        mainScreen.classList.add('active');

        // Kendi kaydımızı yerel listede göster
        updateMembersList();

        // Kendi sesimizi analiz et
        startLocalAudioAnalysis();

    } catch (err) {
        console.error(err);
        showStatus("Bağlantı hatası: " + err.message, "error");
        btnConnect.disabled = false;
        if (localStream) {
            localStream.getTracks().forEach(t => t.stop());
        }
    }
}

// WebRTC Çağrı Başlatma (Initiator)
async function initiateCall(targetConnectionId) {
    if (peerConnections[targetConnectionId]) return;

    log(`Arama başlatılıyor, Hedef: ${targetConnectionId}`);
    const pc = createPeerConnection(targetConnectionId, true);
    
    // Teklif oluştur
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    // Sinyali gönder
    await connection.invoke("SendSignal", targetConnectionId, JSON.stringify({ offer: offer, username: myUsername }));
}

// WebRTC Sinyal İşleme
async function handleWebRtcSignal(senderConnectionId, signal) {
    let pc = peerConnections[senderConnectionId];

    if (signal.offer) {
        log(`Teklif alındı, Gönderen: ${senderConnectionId}`);
        if (!pc) {
            pc = createPeerConnection(senderConnectionId, false);
        }
        
        pc.iceQueue = pc.iceQueue || [];
        await pc.setRemoteDescription(new RTCSessionDescription(signal.offer));
        
        // Eğer kullanıcı ismi sinyalde varsa kaydet
        if (signal.username) {
            updateMemberName(senderConnectionId, signal.username);
        }

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        await connection.invoke("SendSignal", senderConnectionId, JSON.stringify({ answer: answer, username: myUsername }));
        
        // Bekleyen ICE adaylarını ekle
        await processIceQueue(pc);
    } 
    else if (signal.answer) {
        log(`Yanıt alındı, Gönderen: ${senderConnectionId}`);
        if (pc) {
            pc.iceQueue = pc.iceQueue || [];
            await pc.setRemoteDescription(new RTCSessionDescription(signal.answer));
            
            // Bekleyen ICE adaylarını ekle
            await processIceQueue(pc);
        }
    } 
    else if (signal.iceCandidate) {
        log(`ICE Candidate alındı, Gönderen: ${senderConnectionId}`);
        if (!pc) {
            pc = createPeerConnection(senderConnectionId, false);
        }
        
        pc.iceQueue = pc.iceQueue || [];
        const candidate = new RTCIceCandidate(signal.iceCandidate);
        
        if (pc.remoteDescription) {
            await pc.addIceCandidate(candidate).catch(e => console.error("ICE adayı eklenirken hata:", e));
        } else {
            pc.iceQueue.push(candidate);
            log("ICE Candidate sıraya alındı (RemoteDescription henüz set edilmemiş).");
        }
    }
}

async function processIceQueue(pc) {
    if (pc.iceQueue && pc.iceQueue.length > 0) {
        log(`${pc.iceQueue.length} adet bekleyen ICE Candidate işleniyor...`);
        for (const candidate of pc.iceQueue) {
            await pc.addIceCandidate(candidate).catch(e => console.error("Sıradaki ICE adayı eklenirken hata:", e));
        }
        pc.iceQueue = [];
    }
}

// Peer Connection Nesnesi Oluşturma
function createPeerConnection(targetConnectionId, isInitiator) {
    const pc = new RTCPeerConnection(rtcConfig);
    peerConnections[targetConnectionId] = pc;
    pc.iceQueue = [];

    // Yerel ses kanalını peer'a ekle
    localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream);
    });

    // ICE adaylarını (connection candidates) topla ve gönder
    pc.onicecandidate = (event) => {
        if (event.candidate) {
            connection.invoke("SendSignal", targetConnectionId, JSON.stringify({ iceCandidate: event.candidate }));
        }
    };

    // Karşı tarafın sesi geldiğinde
    pc.ontrack = (event) => {
        const remoteStream = (event.streams && event.streams[0]) ? event.streams[0] : new MediaStream([event.track]);
        remoteStreams[targetConnectionId] = remoteStream;

        // Ses oynatıcı element oluştur
        let audio = audioElements[targetConnectionId];
        if (!audio) {
            audio = document.createElement('audio');
            audio.autoplay = true;
            audio.controls = false;
            audioContainer.appendChild(audio);
            audioElements[targetConnectionId] = audio;
        }
        audio.srcObject = remoteStream;

        // Ses çalmayı garanti altına almak için tetikliyoruz
        audio.play().catch(err => {
            console.error("Ses çalınamadı (etkileşim gerekebilir):", err);
        });

        // Karşı tarafın konuşup konuşmadığını algıla
        startAudioAnalysis(targetConnectionId, remoteStream);
        updateMembersList();
    };

    pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        const logType = state === 'connected' ? 'success' : (state === 'failed' ? 'error' : 'info');
        log(`WebRTC Connection State: ${state}`, logType);
        
        if (state === 'disconnected' || state === 'failed' || state === 'closed') {
            closePeerConnection(targetConnectionId);
        }
    };

    pc.oniceconnectionstatechange = () => {
        const state = pc.iceConnectionState;
        const logType = state === 'connected' ? 'success' : (state === 'failed' ? 'error' : 'info');
        log(`WebRTC ICE Connection State: ${state}`, logType);
    };

    return pc;
}

// Bağlantıyı Kapatma
function closePeerConnection(connectionId) {
    if (peerConnections[connectionId]) {
        peerConnections[connectionId].close();
        delete peerConnections[connectionId];
    }
    if (audioElements[connectionId]) {
        audioElements[connectionId].remove();
        delete audioElements[connectionId];
    }
    if (remoteStreams[connectionId]) {
        delete remoteStreams[connectionId];
    }
    if (audioAnalysers[connectionId]) {
        delete audioAnalysers[connectionId];
    }
    
    // UI'dan kaldır
    const el = document.getElementById(`member-${connectionId}`);
    if (el) el.remove();
}

function startAudioAnalysis(connectionId, stream) {
    try {
        if (!audioCtx) {
            log("Global AudioContext henüz başlatılmamış.");
            return;
        }

        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 512;
        
        source.connect(analyser);
        
        // Sesi hoparlör çıkışına (destination) bağlıyoruz.
        analyser.connect(audioCtx.destination);

        audioAnalysers[connectionId] = analyser;
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        function checkVolume() {
            if (!audioAnalysers[connectionId]) return; // Bağlantı koptuysa sonlandır
            
            analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < bufferLength; i++) {
                sum += dataArray[i];
            }
            const average = sum / bufferLength;

            // Ses seviyesi eşiği (Threshold). Çok gürültülü ortamlarda ayarlanabilir
            const isSpeaking = average > 12; 
            
            const memberEl = document.getElementById(`member-${connectionId}`);
            if (memberEl) {
                const badgeContainer = memberEl.querySelector('.member-badges');
                if (isSpeaking) {
                    memberEl.classList.add('speaking');
                    if (!badgeContainer.querySelector('.badge-speaking')) {
                        badgeContainer.innerHTML = '<i class="fa-solid fa-volume-high badge-speaking"></i>';
                    }
                } else {
                    memberEl.classList.remove('speaking');
                    badgeContainer.innerHTML = '';
                }
            }

            requestAnimationFrame(checkVolume);
        }
        checkVolume();
    } catch (e) {
        console.error("Ses analizi başlatılamadı: ", e);
    }
}

// Kendi Sesimizi Arayüzde Canlandırmak İçin Analiz
function startLocalAudioAnalysis() {
    try {
        if (!audioCtx) return;
        const source = audioCtx.createMediaStreamSource(localStream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        function checkLocalVolume() {
            if (!localStream) return;
            
            analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < bufferLength; i++) {
                sum += dataArray[i];
            }
            const average = sum / bufferLength;

            // Eğer (Bas-konuş aktifse ve tuşa basılıysa) veya (Sürekli açık moddaysa ve susturulmamışsa) konuşuyor yap
            const isSpeaking = !isMuted && average > 12 && (isPttMode ? isPttActive : true);

            const myMemberEl = document.getElementById(`member-me`);
            if (myMemberEl) {
                const badgeContainer = myMemberEl.querySelector('.member-badges');
                if (isSpeaking) {
                    myMemberEl.classList.add('speaking');
                    centralMic.classList.add('speaking');
                    if (!badgeContainer.querySelector('.badge-speaking')) {
                        badgeContainer.innerHTML = '<i class="fa-solid fa-volume-high badge-speaking"></i>';
                    }
                } else {
                    myMemberEl.classList.remove('speaking');
                    centralMic.classList.remove('speaking');
                    badgeContainer.innerHTML = '';
                }
            }

            requestAnimationFrame(checkLocalVolume);
        }
        checkLocalVolume();
    } catch (e) {
        console.error("Lokal ses analizi hatası:", e);
    }
}

// Bas-Konuş Tuşunun Durumu
function setPushToTalkState(active) {
    if (!isPttMode) return; // Bas-konuş aktif değilse (Sürekli Açık) tuş durumunu yoksay
    if (isMuted) return; // Susturulmuşsa bas-konuş çalışmasın
    
    isPttActive = active;
    setMicTrackEnabled(active);

    if (active) {
        pttIndicatorCircle.classList.add('active');
        micStatusText.textContent = "KONUŞUYOR";
        micStatusText.classList.add('active');
    } else {
        pttIndicatorCircle.classList.remove('active');
        micStatusText.textContent = "MİKROFON KAPALI";
        micStatusText.classList.remove('active');
    }
}

// Mikrofon Kanalını Etkinleştir/Devre Dışı Bırak
function setMicTrackEnabled(enabled) {
    if (localStream) {
        localStream.getAudioTracks().forEach(track => {
            track.enabled = enabled;
        });
    }
}

// Mikrofonu Tamamen Susturma (Mute Butonu)
btnMute.addEventListener('click', () => {
    isMuted = !isMuted;
    
    if (isMuted) {
        btnMute.classList.add('active');
        btnMute.innerHTML = '<i class="fa-solid fa-microphone-slash"></i>';
        setMicTrackEnabled(false);
        micStatusText.textContent = "SUSTURULDU";
        micStatusText.classList.remove('active');
        
        const myMemberEl = document.getElementById('member-me');
        if (myMemberEl) {
            myMemberEl.classList.add('muted');
        }
    } else {
        btnMute.classList.remove('active');
        btnMute.innerHTML = '<i class="fa-solid fa-microphone"></i>';
        
        // Eğer bas-konuş aktifse tuş durumuna göre, değilse direkt aç
        const shouldEnable = isPttMode ? isPttActive : true;
        setMicTrackEnabled(shouldEnable);
        
        if (isPttMode) {
            micStatusText.textContent = isPttActive ? "KONUŞUYOR" : "MİKROFON KAPALI";
            if (isPttActive) micStatusText.classList.add('active');
            else micStatusText.classList.remove('active');
        } else {
            micStatusText.textContent = "MİKROFON AÇIK";
            micStatusText.classList.add('active');
        }
        
        const myMemberEl = document.getElementById('member-me');
        if (myMemberEl) {
            myMemberEl.classList.remove('muted');
        }
    }
});

// Bağlantıyı Kesme
btnDisconnect.addEventListener('click', disconnectAll);

function disconnectAll() {
    if (connection) {
        connection.stop();
    }
    
    // WebRTC temizliği
    Object.keys(peerConnections).forEach(closePeerConnection);
    
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }

    loginScreen.classList.add('active');
    mainScreen.classList.remove('active');
    btnConnect.disabled = false;
    showStatus("Bağlantı kesildi.", "info");
}

// Odadaki Üyeler Listesini Güncelle
function updateMembersList() {
    // Kendi adımızı her zaman ilk sıraya koy
    let html = `
        <div id="member-me" class="member-item ${isMuted ? 'muted' : ''}">
            <div class="member-avatar" style="background-color: var(--primary)">${myUsername.substring(0,2).toUpperCase()}</div>
            <div class="member-info">
                <span class="member-name">${myUsername} (Sen)</span>
                <span class="member-status">Aktif</span>
            </div>
            <div class="member-badges"></div>
        </div>
    `;

    // Diğer bağlı kişileri ekle
    Object.keys(peerConnections).forEach(connId => {
        const username = peerConnections[connId].remoteUsername || "Misafir";
        html += `
            <div id="member-${connId}" class="member-item">
                <div class="member-avatar" style="background-color: #3b82f6">${username.substring(0,2).toUpperCase()}</div>
                <div class="member-info">
                    <span class="member-name">${username}</span>
                    <span class="member-status">Bağlı</span>
                </div>
                <div class="member-badges"></div>
            </div>
        `;
    });

    membersList.innerHTML = html;
}

function updateMemberName(connectionId, username) {
    if (peerConnections[connectionId]) {
        peerConnections[connectionId].remoteUsername = username;
        updateMembersList();
    }
}

// Tuş Değiştirme Sistemi
btnChangeKey.addEventListener('click', () => {
    isListeningForKey = true;
    btnChangeKey.textContent = "Tuşa Basın...";
    btnChangeKey.classList.add('listening');
    
    // JS'te de geçici olarak klavyeyi dinleyelim (Eğer uygulama odaklanmışsa)
    const keyListener = (e) => {
        e.preventDefault();
        
        // Windows Sanal Tuş Kodları (VK Codes) eşleştirmesi
        // Çoğu yaygın tuş için tahmini VK kodları
        let vkCode = 0;
        let keyName = e.key;

        // Sık kullanılan bas-konuş tuşları ve C# sanal tuş kodları
        if (e.key === 'Control') {
            vkCode = 162; // Left Ctrl
            keyName = "Sol Ctrl";
        } else if (e.key === 'Shift') {
            vkCode = 160; // Left Shift
            keyName = "Sol Shift";
        } else if (e.key === 'Alt') {
            vkCode = 18;  // Alt
            keyName = "Alt";
        } else if (e.key === 'Capslock') {
            vkCode = 20;  // Caps Lock
            keyName = "Caps Lock";
        } else if (e.key === ' ') {
            vkCode = 32;  // Space
            keyName = "Space";
        } else {
            vkCode = e.keyCode; // Varsayılan keyCode (tarayıcı kodları Windows API ile genelde eşleşir)
            keyName = e.key.toUpperCase();
        }

        // C#'a bildir
        sendToCsharp("set_ptt_key", vkCode);
        
        pttKeyDisplay.textContent = keyName;
        btnChangeKey.textContent = "Değiştir";
        btnChangeKey.classList.remove('listening');
        
        window.removeEventListener('keydown', keyListener);
        isListeningForKey = false;
    };
    
    window.addEventListener('keydown', keyListener);
});

// Bas-Konuş Modu Değişimi Dinleyicisi
chkPttMode.addEventListener('change', () => {
    isPttMode = chkPttMode.checked;
    
    if (isPttMode) {
        pttSettingsArea.style.display = 'block';
        openmicSettingsArea.style.display = 'none';
        setPushToTalkState(false);
    } else {
        pttSettingsArea.style.display = 'none';
        openmicSettingsArea.style.display = 'block';
        isPttActive = false;
        
        // Susturulmamışsa mikrofonu sürekli açık yap
        setMicTrackEnabled(!isMuted);
        
        pttIndicatorCircle.classList.remove('active');
        micStatusText.textContent = isMuted ? "SUSTURULDU" : "MİKROFON AÇIK";
        if (!isMuted) {
            micStatusText.classList.add('active');
        } else {
            micStatusText.classList.remove('active');
        }
    }
    
    updateMembersList();
});

// Hata ayıklama günlüğü aç/kapat dinleyicisi
const debugHeader = document.getElementById('debug-header');
const debugLogs = document.getElementById('debug-logs');
const debugIcon = document.getElementById('debug-icon');
if (debugHeader && debugLogs && debugIcon) {
    debugHeader.addEventListener('click', () => {
        if (debugLogs.style.display === 'none') {
            debugLogs.style.display = 'flex';
            debugIcon.className = 'fa-solid fa-chevron-down';
        } else {
            debugLogs.style.display = 'none';
            debugIcon.className = 'fa-solid fa-chevron-up';
        }
    });
}

// Yardımcı Fonksiyonlar
function showStatus(msg, type) {
    connectionStatus.textContent = msg;
    connectionStatus.className = "status-message " + type;
}

function log(msg, type = 'info') {
    console.log(`[${type.toUpperCase()}] ${msg}`);
    sendToCsharp("log", `[${type.toUpperCase()}] ${msg}`);
    
    const logsEl = document.getElementById('debug-logs');
    if (logsEl) {
        const item = document.createElement('div');
        item.className = `log-item ${type}`;
        item.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
        logsEl.appendChild(item);
        logsEl.scrollTop = logsEl.scrollHeight;
    }
}
