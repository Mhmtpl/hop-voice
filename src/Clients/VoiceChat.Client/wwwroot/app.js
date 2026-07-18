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
const btnDeafen = document.getElementById('btn-deafen');
const selectMic = document.getElementById('select-mic');
const selectSpeaker = document.getElementById('select-speaker');
const latencyIndicator = document.getElementById('latency-indicator');

// Mod Seçimi Elementleri
const chkPttMode = document.getElementById('chk-ptt-mode');
const pttKeyContainer = document.getElementById('ptt-key-container');
const openmicSettingsArea = document.getElementById('openmic-settings-area');

// Mikrofon Testi Elementleri
const btnTestMic = document.getElementById('btn-test-mic');
const testMicText = document.getElementById('test-mic-text');
const micTestContainer = document.getElementById('mic-test-container');
const micTestFill = document.getElementById('mic-test-fill');

// Yazılı Sohbet Elementleri
const btnToggleChat = document.getElementById('btn-toggle-chat');
const chatPanel = document.getElementById('chat-panel');
const chatMessages = document.getElementById('chat-messages');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const btnAttach = document.getElementById('btn-attach');
const chatFileInput = document.getElementById('chat-file-input');
const imageModal = document.getElementById('image-modal');
const modalImg = document.getElementById('modal-img');
const closeImageViewer = document.getElementById('close-image-viewer');
const btnSettings = document.getElementById('btn-settings');
const settingsModal = document.getElementById('settings-modal');
const btnCloseSettings = document.getElementById('btn-close-settings');
const chatDragOverlay = document.getElementById('chat-drag-overlay');
const chatPreviewArea = document.getElementById('chat-preview-area');
const chatPreviewImg = document.getElementById('chat-preview-img');
const btnCancelPreview = document.getElementById('btn-cancel-preview');
let stagedImageBase64 = null;

// Görüntülü Arama & Ekran Paylaşımı Elementleri ve Durumları
const btnCamera = document.getElementById('btn-camera');
const btnScreenshare = document.getElementById('btn-screenshare');
const screenshareContainer = document.getElementById('screenshare-container');
const screenshareVideo = document.getElementById('screenshare-video');
const screenshareUsername = document.getElementById('screenshare-username');
const videoGridContainer = document.getElementById('video-grid-container');
const btnFullscreenShare = document.getElementById('btn-fullscreen-share');

let isSharingCamera = false;
let isSharingScreen = false;
let localCameraStream = null;
let localScreenStream = null;
let activeScreenSharerId = null; // Ekran paylaşan peer'ın connectionId'si
let remoteCameraStreamIds = {};  // connectionId -> streamId eşleşmesi
let remoteScreenStreamIds = {};  // connectionId -> streamId eşleşmesi

// LocalStorage'tan son giriş bilgilerini geri yükle
try {
    const savedServer = localStorage.getItem('hop_server_url');
    const savedUsername = localStorage.getItem('hop_username');
    const savedRoom = localStorage.getItem('hop_room_id');
    if (savedServer) inputServerUrl.value = savedServer;
    if (savedUsername) inputUsername.value = savedUsername;
    if (savedRoom) inputRoomId.value = savedRoom;
} catch (e) {
    console.error("LocalStorage yükleme hatası:", e);
}

// Global Değişkenler
let connection = null;
let audioCtx = null;
let localStream = null;
let myConnectionId = null;
let myUsername = "";
let currentRoom = "";
let isMuted = false; // Yazılımsal susturma (tıklama ile)
let isDeafened = false; // Sağırlaştırma durumu
let isPttActive = false; // Bas-konuş tuşunun basılı olma durumu
let isPttMode = false; // Bas-konuş modunun açık olup olmadığı (değilse sürekli açık)
let isListeningForKey = false;
let selectedMicId = "";
let selectedSpeakerId = "";
let lastPingTime = 0;
let pingInterval = null;
let localAudioSource = null;
let localAudioAnalyser = null;

// Mikrofon Test Durumu
let testStream = null;
let testAudioCtx = null;
let testAnalyser = null;
let testAnimationId = null;
let isTestingMic = false;

// Peer Connections: ConnectionId -> RTCPeerConnection
const peerConnections = {};
// Remote Streams: ConnectionId -> MediaStream
const remoteStreams = {};
// Audio Elements: ConnectionId -> HTMLAudioElement
const audioElements = {};
// Analysers for Voice Activity Detection: ConnectionId -> AnalyserNode
const audioAnalysers = {};
// Gain Nodes for Volume Control: ConnectionId -> GainNode
const gainNodes = {};

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
        let message = event.data;
        if (typeof message === 'string') {
            try {
                message = JSON.parse(message);
            } catch (e) {
                console.error("C#'tan gelen mesaj ayrıştırılamadı:", e);
                return;
            }
        }
        if (message && message.action) {
            handleCsharpMessage(message.action, message.data);
        }
    });
}

function handleCsharpMessage(action, data) {
    switch (action) {
        case 'ptt_state':
            // Bas-konuş tuşunun durumu değişti (active: true/false)
            log(`PTT Tuş Tetiklendi: ${data.active ? 'BASILDI' : 'BIRAKILDI'}`, 'info');
            setPushToTalkState(data.active);
            break;
        case 'get_states':
            sendToCsharp("state_changed", { isMuted: isMuted, isDeafened: isDeafened });
            break;
        case 'toggle_mute':
            toggleMuteState();
            break;
        case 'toggle_deafen':
            toggleDeafenState();
            break;
        case 'disconnect':
            disconnectAll();
            break;
    }
}

// Giriş Butonu Tıklaması
btnConnect.addEventListener('click', connectToVoiceChat);

// Bağlan Fonksiyonu
async function connectToVoiceChat() {
    // Mikrofon testi açık ise temizlemek için kapat
    if (isTestingMic) {
        await toggleMicTest();
    }
    const serverUrl = inputServerUrl.value.trim();
    myUsername = inputUsername.value.trim() || "Anonim_" + Math.floor(Math.random() * 1000);
    currentRoom = inputRoomId.value.trim() || "Genel";

    if (!serverUrl) {
        showStatus("Lütfen geçerli bir sunucu adresi girin.", "error");
        return;
    }

    showStatus("Mikrofona erişiliyor...", "info");
    btnConnect.disabled = true;

    let micAccessError = false;
    try {
        // 1. Kullanıcı mikrofonunu al
        const constraints = { 
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            }, 
            video: false 
        };
        if (selectedMicId) {
            constraints.audio.deviceId = { exact: selectedMicId };
        }
        
        localStream = await navigator.mediaDevices.getUserMedia(constraints);

        // Mikrofonu başlangıç moduna göre ayarla (Bas-konuş veya sürekli açık)
        setMicTrackEnabled(!isPttMode);
    } catch (err) {
        console.warn("Mikrofona erişilemedi veya mikrofon bulunamadı:", err);
        localStream = null;
        micAccessError = true;
        isMuted = true; // Mikrofon yoksa sessize alalım
    }

    try {
        // Ses cihazlarını listele
        await loadAudioDevices().catch(e => console.warn("Cihaz listeleme hatası:", e));

        // Global AudioContext'i kullanıcı etkileşimi esnasında oluşturup başlatıyoruz.
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') {
            await audioCtx.resume();
        }

        if (micAccessError) {
            showStatus("Mikrofon bulunamadı. Dinleme modunda bağlanılıyor...", "info");
        } else {
            showStatus("Sunucuya bağlanılıyor...", "info");
        }

        // 2. SignalR Bağlantısını Kur
        connection = new signalR.HubConnectionBuilder()
            .withUrl(`${serverUrl}/signaling`)
            .withAutomaticReconnect()
            .build();

        // Sunucu Olayları
        connection.on("UserJoined", async (connectionId) => {
            log(`Kullanıcı katıldı: ${connectionId}`);
            playChime(true);
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
            
            if (signal.muteState) {
                if (peerConnections[senderConnectionId]) {
                    peerConnections[senderConnectionId].isMuted = signal.muteState.isMuted;
                    peerConnections[senderConnectionId].isDeafened = signal.muteState.isDeafened;
                    updateMembersList();
                }
                return;
            }
            
            await handleWebRtcSignal(senderConnectionId, signal);
        });

        connection.on("UserLeft", (connectionId) => {
            log(`Kullanıcı ayrıldı: ${connectionId}`);
            playChime(false);
            closePeerConnection(connectionId);
        });

        connection.on("OnCameraShareToggled", (sharingUserId, username, isSharing, streamId) => {
            log(`Kamera paylaşım uyarısı: ${username} (${sharingUserId}) -> ${isSharing}, Stream: ${streamId}`);
            if (isSharing) {
                remoteCameraStreamIds[sharingUserId] = streamId;
                if (peerConnections[sharingUserId]) {
                    peerConnections[sharingUserId].isSharingCamera = true;
                }
                closePeerConnection(sharingUserId);
            } else {
                delete remoteCameraStreamIds[sharingUserId];
                removeRemoteVideoElement(sharingUserId);
                if (peerConnections[sharingUserId]) {
                    peerConnections[sharingUserId].isSharingCamera = false;
                }
                closePeerConnection(sharingUserId);
            }
            updateVideoLayout();
        });

        connection.on("OnScreenShareToggled", (sharingUserId, username, isSharing, streamId) => {
            log(`Ekran paylaşım uyarısı: ${username} (${sharingUserId}) -> ${isSharing}, Stream: ${streamId}`);
            if (isSharing) {
                remoteScreenStreamIds[sharingUserId] = streamId;
                activeScreenSharerId = sharingUserId;
                closePeerConnection(sharingUserId);
            } else {
                delete remoteScreenStreamIds[sharingUserId];
                if (activeScreenSharerId === sharingUserId) {
                    activeScreenSharerId = null;
                    screenshareContainer.style.display = 'none';
                    screenshareVideo.srcObject = null;
                }
                closePeerConnection(sharingUserId);
            }
            updateVideoLayout();
        });

        connection.on("Pong", () => {
            const currentPing = Date.now() - lastPingTime;
            latencyIndicator.innerHTML = `<i class="fa-solid fa-wifi" style="color: #10b981;"></i> ${currentPing} ms`;
        });

        connection.on("ReceiveChatMessage", (senderConnectionId, username, message) => {
            appendChatMessage(senderConnectionId, username, message);
        });

        connection.on("ReceiveChatImage", (senderConnectionId, username, base64Data) => {
            appendChatImage(senderConnectionId, username, base64Data);
        });

        // Bağlantıyı Başlat
        await connection.start();
        
        myConnectionId = connection.connectionId;
        log(`SignalR Bağlantısı kuruldu. ID: ${myConnectionId}`);

        // Giriş bilgilerini kaydet
        try {
            localStorage.setItem('hop_server_url', serverUrl);
            localStorage.setItem('hop_username', myUsername);
            localStorage.setItem('hop_room_id', currentRoom);
        } catch (e) {
            console.error("LocalStorage kaydetme hatası:", e);
        }

        // Odaya Katıl
        await connection.invoke("JoinRoom", currentRoom, myUsername);
        playChime(true);
        showToast(`Ses odasına bağlanıldı: ${currentRoom}`, "success");

        // Ping-Pong gecikme testi başlat
        pingInterval = setInterval(async () => {
            if (connection && connection.state === signalR.HubConnectionState.Connected) {
                lastPingTime = Date.now();
                await connection.invoke("Ping").catch(err => console.error(err));
            }
        }, 5000);

        // Arayüzü Güncelle
        myUsernameDisplay.textContent = myUsername;
        myAvatarDisplay.textContent = myUsername.substring(0, 2).toUpperCase();
        activeRoomName.textContent = currentRoom;
        headerRoomName.textContent = currentRoom;

        loginScreen.classList.remove('active');
        mainScreen.classList.add('active');

        // C# tarafına ses odasına başarıyla bağlandığımızı ve ilk mute durumunu bildir
        sendToCsharp("connection_state", { connected: true, room: currentRoom });
        sendToCsharp("state_changed", { isMuted: isMuted, isDeafened: isDeafened });

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
            
            // Eğer kullanıcı ismi sinyalde varsa kaydet (Initiator tarafında isim güncellemesi)
            if (signal.username) {
                updateMemberName(senderConnectionId, signal.username);
            }
            
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

    // Yerel ses kanalını peer'a ekle (eğer mikrofon varsa)
    if (localStream) {
        localStream.getTracks().forEach(track => {
            pc.addTrack(track, localStream);
        });
    }

    // Yerel kamera video kanalını peer'a ekle
    if (localCameraStream) {
        localCameraStream.getTracks().forEach(track => {
            pc.addTrack(track, localCameraStream);
        });
    }

    // Yerel ekran video kanalını peer'a ekle
    if (localScreenStream) {
        localScreenStream.getTracks().forEach(track => {
            pc.addTrack(track, localScreenStream);
        });
    }

    // ICE adaylarını (connection candidates) topla ve gönder
    pc.onicecandidate = (event) => {
        if (event.candidate) {
            connection.invoke("SendSignal", targetConnectionId, JSON.stringify({ iceCandidate: event.candidate }));
        }
    };

    // Karşı tarafın sesi veya görüntüsü geldiğinde
    pc.ontrack = (event) => {
        const remoteStream = (event.streams && event.streams[0]) ? event.streams[0] : new MediaStream([event.track]);
        const streamId = event.streams && event.streams[0] ? event.streams[0].id : null;

        // Video Kanalı Algılama (Kamera veya Ekran Paylaşımı)
        if (event.track.kind === 'video') {
            log(`Video track alındı, Hedef: ${targetConnectionId}, StreamID: ${streamId}`);
            
            // Stream ID eşleşmesine göre ekran paylaşımı olup olmadığını doğrula
            const isScreenShare = (streamId && streamId === remoteScreenStreamIds[targetConnectionId]) || 
                                  (targetConnectionId === myConnectionId && localScreenStream && streamId === localScreenStream.id);

            if (isScreenShare) {
                screenshareVideo.srcObject = remoteStream;
                screenshareUsername.textContent = `${peerConnections[targetConnectionId]?.remoteUsername || 'Arkadaşınız'} ekran paylaşıyor`;
                screenshareContainer.style.display = 'flex';
                activeScreenSharerId = targetConnectionId;
                updateVideoLayout();

                event.track.onended = () => {
                    if (activeScreenSharerId === targetConnectionId) {
                        activeScreenSharerId = null;
                        screenshareContainer.style.display = 'none';
                        screenshareVideo.srcObject = null;
                        updateVideoLayout();
                    }
                };
            } else {
                createOrUpdateRemoteVideoElement(targetConnectionId, remoteStream);
                if (peerConnections[targetConnectionId]) {
                    peerConnections[targetConnectionId].isSharingCamera = true;
                }
                updateVideoLayout();

                event.track.onended = () => {
                    removeRemoteVideoElement(targetConnectionId);
                    if (peerConnections[targetConnectionId]) {
                        peerConnections[targetConnectionId].isSharingCamera = false;
                    }
                    updateVideoLayout();
                };
            }
            return;
        }

        // Ses Kanalı (Audio)
        remoteStreams[targetConnectionId] = remoteStream;
        let audio = audioElements[targetConnectionId];
        if (!audio) {
            audio = document.createElement('audio');
            audio.autoplay = true;
            audio.controls = false;
            audio.muted = true; // Çift çalmayı önlemek için sessize alıyoruz. Ses Web Audio API (GainNode) üzerinden çıkacak.
            audioContainer.appendChild(audio);
            audioElements[targetConnectionId] = audio;
        }
        audio.srcObject = remoteStream;

        // Karşı tarafın konuşup konuşmadığını algıla ve Web Audio API ses yolunu kur
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

    // Bağlantı kurulurken karşı tarafa kendi güncel mute/deafen durumumuzu göndeririz
    if (connection && connection.state === signalR.HubConnectionState.Connected) {
        setTimeout(() => {
            connection.invoke("SendSignal", targetConnectionId, JSON.stringify({
                muteState: {
                    isMuted: isMuted,
                    isDeafened: isDeafened
                }
            })).catch(err => console.error("Başlangıç MuteState hatası:", err));
        }, 500);
    }

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
    if (gainNodes[connectionId]) {
        delete gainNodes[connectionId];
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
        
        // Ses seviyesini kontrol etmek için GainNode (Ses Kazancı) oluşturuyoruz
        const gainNode = audioCtx.createGain();
        
        // Varsayılan veya önceden ayarlanmış ses seviyesini al
        const vol = (peerConnections[connectionId] && peerConnections[connectionId].volumeLevel !== undefined)
            ? peerConnections[connectionId].volumeLevel
            : 100;
        
        // Sağırlaştırma aktifse sesi 0 yap, değilse slider seviyesine çek
        gainNode.gain.setValueAtTime(isDeafened ? 0 : (vol / 100), audioCtx.currentTime);
        
        source.connect(analyser);
        analyser.connect(gainNode);
        
        // Sesi hoparlör çıkışına (destination) GainNode üzerinden bağlıyoruz.
        gainNode.connect(audioCtx.destination);

        audioAnalysers[connectionId] = analyser;
        gainNodes[connectionId] = gainNode;
        
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
                if (isSpeaking) {
                    memberEl.classList.add('speaking');
                } else {
                    memberEl.classList.remove('speaking');
                }
            }

            const videoCard = document.getElementById(`videocard-${connectionId}`);
            if (videoCard) {
                if (isSpeaking) {
                    videoCard.classList.add('speaking');
                } else {
                    videoCard.classList.remove('speaking');
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
        if (!audioCtx || !localStream) return;
        
        // Eğer eski bir kaynak varsa bağlantısını kes
        if (localAudioSource) {
            try { localAudioSource.disconnect(); } catch(err){}
        }
        
        localAudioSource = audioCtx.createMediaStreamSource(localStream);
        localAudioAnalyser = audioCtx.createAnalyser();
        localAudioAnalyser.fftSize = 256;
        localAudioSource.connect(localAudioAnalyser);

        const bufferLength = localAudioAnalyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        const currentAnalyser = localAudioAnalyser;

        function checkLocalVolume() {
            // Eğer stream yoksa veya analizör değiştiyse döngüden çık
            if (!localStream || localAudioAnalyser !== currentAnalyser) return;
            
            currentAnalyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < bufferLength; i++) {
                sum += dataArray[i];
            }
            const average = sum / bufferLength;

            // Eğer (Bas-konuş aktifse ve tuşa basılıysa) veya (Sürekli açık moddaysa ve susturulmamışsa) konuşuyor yap
            const isSpeaking = !isMuted && average > 12 && (isPttMode ? isPttActive : true);

            const myMemberEl = document.getElementById(`member-me`);
            if (myMemberEl) {
                if (isSpeaking) {
                    myMemberEl.classList.add('speaking');
                    centralMic.classList.add('speaking');
                } else {
                    myMemberEl.classList.remove('speaking');
                    centralMic.classList.remove('speaking');
                }
            }

            const myVideoCard = document.getElementById(`videocard-${myConnectionId}`);
            if (myVideoCard) {
                if (isSpeaking) {
                    myVideoCard.classList.add('speaking');
                } else {
                    myVideoCard.classList.remove('speaking');
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

function broadcastMuteState() {
    if (connection && connection.state === signalR.HubConnectionState.Connected) {
        Object.keys(peerConnections).forEach(connId => {
            connection.invoke("SendSignal", connId, JSON.stringify({
                muteState: {
                    isMuted: isMuted,
                    isDeafened: isDeafened
                }
            })).catch(err => console.error("MuteState gönderme hatası:", err));
        });
    }
}

// Mikrofonu Tamamen Susturma (Mute Butonu)
btnMute.addEventListener('click', toggleMuteState);

function toggleMuteState() {
    isMuted = !isMuted;
    updateMuteUI();
    updateMembersList();
    broadcastMuteState();
    sendToCsharp("state_changed", { isMuted: isMuted, isDeafened: isDeafened });
}

function updateMuteUI() {
    if (isMuted) {
        btnMute.classList.add('active');
        btnMute.innerHTML = '<i class="fa-solid fa-microphone-slash"></i>';
        setMicTrackEnabled(false);
        micStatusText.textContent = "SUSTURULDU";
        micStatusText.className = "mic-status";
        
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
}

// Bağlantıyı Kesme
btnDisconnect.addEventListener('click', disconnectAll);

function disconnectAll() {
    playChime(false);
    if (pingInterval) {
        clearInterval(pingInterval);
        pingInterval = null;
    }

    if (connection) {
        connection.stop();
    }
    
    // WebRTC temizliği
    Object.keys(peerConnections).forEach(closePeerConnection);
    
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }

    isDeafened = false;
    btnDeafen.classList.remove('active');
    btnDeafen.innerHTML = '<i class="fa-solid fa-headphones"></i>';
    latencyIndicator.innerHTML = '<i class="fa-solid fa-wifi"></i> Bağlı';

    loginScreen.classList.add('active');
    mainScreen.classList.remove('active');
    btnConnect.disabled = false;
    showStatus("Bağlantı kesildi.", "info");
    
    // C# tarafına ses odasından ayrıldığımızı bildir
    sendToCsharp("connection_state", { connected: false });
}

// Odadaki Üyeler Listesini Güncelle
function updateMembersList() {
    // Kendi adımızı her zaman ilk sıraya koy
    let html = `
        <div id="member-me" class="member-item ${isMuted ? 'muted' : ''} ${isDeafened ? 'deafened' : ''}">
            <div class="member-avatar" style="background-color: var(--primary)">${myUsername.substring(0,2).toUpperCase()}</div>
            <div class="member-info">
                <span class="member-name">${myUsername} (Sen)</span>
                <span class="member-status">${isDeafened ? 'Sağırlaştırıldı' : (isMuted ? 'Susturuldu' : 'Aktif')}</span>
            </div>
            <div class="member-badges">
                ${isDeafened ? '<span class="deafen-badge-wrapper"><i class="fa-solid fa-headphones text-danger"></i></span>' : (isMuted ? '<i class="fa-solid fa-microphone-slash text-danger"></i>' : '')}
            </div>
        </div>
    `;

    // Diğer bağlı kişileri ekle
    Object.keys(peerConnections).forEach(connId => {
        const pc = peerConnections[connId];
        const username = pc.remoteUsername || "Misafir";
        const vol = pc.volumeLevel !== undefined ? pc.volumeLevel : 100;
        
        let volIcon = 'fa-volume-high';
        if (vol === 0) volIcon = 'fa-volume-xmark';
        else if (vol < 50) volIcon = 'fa-volume-low';

        // Durum Metni
        let statusText = "Bağlı";
        if (pc.isDeafened) statusText = "Sağırlaştırıldı";
        else if (pc.isMuted) statusText = "Susturuldu";

        // Rozetler (Sağırlaştırma veya Susturma İkonu)
        let badgesHtml = "";
        if (pc.isDeafened) {
            badgesHtml = '<span class="deafen-badge-wrapper"><i class="fa-solid fa-headphones text-danger"></i></span>';
        } else if (pc.isMuted) {
            badgesHtml = '<i class="fa-solid fa-microphone-slash text-danger"></i>';
        } else if (vol === 0) {
            badgesHtml = '<i class="fa-solid fa-volume-xmark text-danger"></i>';
        }

        html += `
            <div id="member-${connId}" class="member-item ${pc.isMuted ? 'muted' : ''} ${pc.isDeafened ? 'deafened' : ''}">
                <div class="member-avatar" style="background-color: #3b82f6">${username.substring(0,2).toUpperCase()}</div>
                <div class="member-info">
                    <span class="member-name">${username}</span>
                    <span class="member-status">${statusText}</span>
                </div>
                <div class="member-badges">
                    ${badgesHtml}
                </div>
                <div class="member-volume-control">
                    <i class="fa-solid ${volIcon}" id="volume-icon-${connId}"></i>
                    <input type="range" class="member-volume-slider" min="0" max="100" value="${vol}" data-conn-id="${connId}">
                </div>
            </div>
        `;
    });

    membersList.innerHTML = html;

    // C# tarafına güncel üye listesini gönder (Hover Popup için)
    try {
        const memberNames = [myUsername + " (Sen)"];
        Object.keys(peerConnections).forEach(connId => {
            const pc = peerConnections[connId];
            const name = pc.remoteUsername || "Misafir";
            let statusText = "";
            if (pc.isDeafened) statusText = " [Sağır]";
            else if (pc.isMuted) statusText = " [Sessiz]";
            memberNames.push(name + statusText);
        });
        sendToCsharp("member_list", memberNames);
    } catch (e) {
        console.error("Üye listesini C#'a gönderme hatası:", e);
    }
}

function updateMemberName(connectionId, username) {
    if (peerConnections[connectionId]) {
        peerConnections[connectionId].remoteUsername = username;
        updateMembersList();
    }
}

// Sağırlaştırma (Deafen) İşlemi
btnDeafen.addEventListener('click', toggleDeafenState);

function toggleDeafenState() {
    isDeafened = !isDeafened;
    updateDeafenUI();
    updateMembersList();
    broadcastMuteState();
    sendToCsharp("state_changed", { isMuted: isMuted, isDeafened: isDeafened });
}

function updateDeafenUI() {
    if (isDeafened) {
        btnDeafen.classList.add('active');
        btnDeafen.innerHTML = '<i class="fa-solid fa-headphones"></i>';
        
        // 1. Mikrofonu sustur
        setMicTrackEnabled(false);
        btnMute.classList.add('active');
        btnMute.innerHTML = '<i class="fa-solid fa-microphone-slash"></i>';
        isMuted = true;
        
        // 2. Karşı taraftan gelen tüm sesleri kapat (GainNode üzerinden)
        Object.keys(gainNodes).forEach(connId => {
            if (gainNodes[connId]) {
                gainNodes[connId].gain.setValueAtTime(0, audioCtx.currentTime);
            }
        });
        
        log("Ses alımı ve gönderimi kapatıldı (Sağırlaştırıldı).", "warning");
    } else {
        btnDeafen.classList.remove('active');
        btnDeafen.innerHTML = '<i class="fa-solid fa-headphones"></i>';
        
        // 1. Mikrofonu aç (Bas-konuş aktifse durumuna göre, değilse direkt aç)
        isMuted = false;
        btnMute.classList.remove('active');
        btnMute.innerHTML = '<i class="fa-solid fa-microphone"></i>';
        const shouldEnableMic = isPttMode ? isPttActive : true;
        setMicTrackEnabled(shouldEnableMic);
        
        // 2. Karşı tarafın seslerini kendi kaydırıcı değerlerine göre geri yükle
        Object.keys(gainNodes).forEach(connId => {
            if (gainNodes[connId]) {
                const vol = peerConnections[connId] && peerConnections[connId].volumeLevel !== undefined 
                    ? peerConnections[connId].volumeLevel 
                    : 100;
                gainNodes[connId].gain.setValueAtTime(vol / 100, audioCtx.currentTime);
            }
        });
        
        log("Ses alımı ve gönderimi tekrar açıldı.", "success");
    }
}

// Bireysel Ses Kaydırıcıları İçin Dinleyici (Event Delegation)
membersList.addEventListener('input', (e) => {
    if (e.target && e.target.classList.contains('member-volume-slider')) {
        const connId = e.target.getAttribute('data-conn-id');
        const value = parseInt(e.target.value);
        if (peerConnections[connId]) {
            peerConnections[connId].volumeLevel = value;
            
            // Eğer sağırlaştırma kapalıysa sesi güncelle
            const gainNode = gainNodes[connId];
            if (gainNode && !isDeafened) {
                gainNode.gain.setValueAtTime(value / 100, audioCtx.currentTime);
            }
            
            // İkon güncellemesi
            const icon = document.getElementById(`volume-icon-${connId}`);
            if (icon) {
                if (value === 0) {
                    icon.className = 'fa-solid fa-volume-xmark';
                } else if (value < 50) {
                    icon.className = 'fa-solid fa-volume-low';
                } else {
                    icon.className = 'fa-solid fa-volume-high';
                }
            }
        }
    }
});

// Ses Cihazlarını Listele (Microphone & Speaker)
async function loadAudioDevices() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        
        // Select temizle
        selectMic.innerHTML = '';
        selectSpeaker.innerHTML = '';
        
        const mics = devices.filter(d => d.kind === 'audioinput');
        const speakers = devices.filter(d => d.kind === 'audiooutput');
        
        if (mics.length === 0) {
            const opt = document.createElement('option');
            opt.value = "";
            opt.textContent = "Mikrofon Bulunamadı";
            selectMic.appendChild(opt);
        }

        mics.forEach((d, index) => {
            const opt = document.createElement('option');
            opt.value = d.deviceId;
            opt.textContent = d.label || `Mikrofon ${index + 1}`;
            if (selectedMicId === d.deviceId) opt.selected = true;
            selectMic.appendChild(opt);
        });
        
        speakers.forEach((d, index) => {
            const opt = document.createElement('option');
            opt.value = d.deviceId;
            opt.textContent = d.label || `Kulaklık/Hoparlör ${index + 1}`;
            if (selectedSpeakerId === d.deviceId) opt.selected = true;
            selectSpeaker.appendChild(opt);
        });
        
        // Varsayılan seçimleri kaydet
        if (!selectedMicId && mics.length > 0) selectedMicId = selectMic.value;
        if (!selectedSpeakerId && speakers.length > 0) selectedSpeakerId = selectSpeaker.value;
        
        log("Ses aygıtları listelendi.", "success");
    } catch (e) {
        console.error("Aygıt listesi alınamadı: ", e);
        log("Aygıt listesi alınamadı.", "error");
    }
}

// Mikrofon Değiştirme
selectMic.addEventListener('change', async (e) => {
    selectedMicId = e.target.value;
    log(`Mikrofon değiştiriliyor: ${selectedMicId}`, "warning");
    
    if (localStream) {
        try {
            // Önce yeni mikrofon kanalını almayı deniyoruz
            const constraints = {
                audio: {
                    deviceId: { exact: selectedMicId }, // exact kullanarak tarayıcının sessizce varsayılana düşmesini engelliyoruz
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                },
                video: false
            };
            const newStream = await navigator.mediaDevices.getUserMedia(constraints);
            const newTrack = newStream.getAudioTracks()[0];
            
            // Eski ses kanallarını durdurup temizliyoruz
            localStream.getAudioTracks().forEach(t => t.stop());
            
            // localStream referansını yeni track ile güncelle
            const oldTrack = localStream.getAudioTracks()[0];
            if (oldTrack) {
                localStream.removeTrack(oldTrack);
            }
            localStream.addTrack(newTrack);
            
            // Tüm aktif aramaların göndericilerindeki track'i kesintisiz değiştir (replaceTrack)
            Object.keys(peerConnections).forEach(connId => {
                const pc = peerConnections[connId];
                if (pc) {
                    const senders = pc.getSenders();
                    const sender = senders.find(s => s.track && s.track.kind === 'audio');
                    if (sender) {
                        sender.replaceTrack(newTrack).catch(ex => console.error("RTP replaceTrack hatası:", ex));
                    }
                }
            });
            
            // Mikrofon susturulma veya bas-konuş durumunu uygula
            const shouldEnable = isMuted ? false : (isPttMode ? isPttActive : true);
            setMicTrackEnabled(shouldEnable);
            
            // Lokal ses analizini yeni stream ile yeniden başlat (AudioContext kaynağını günceller)
            startLocalAudioAnalysis();
            
            log("Mikrofon başarıyla değiştirildi.", "success");
        } catch (err) {
            console.error("Mikrofon değiştirilirken hata oluştu:", err);
            log(`Mikrofon değiştirilemedi! Hata: ${err.name} - ${err.message}`, "error");
        }
    }
});

// Hoparlör Değiştirme
selectSpeaker.addEventListener('change', async (e) => {
    selectedSpeakerId = e.target.value;
    log(`Hoparlör değiştiriliyor: ${selectedSpeakerId}`, "warning");
    
    // Ses çıkışı Web Audio API üzerinden olduğu için AudioContext'in sinkId'sini değiştiriyoruz
    if (audioCtx && typeof audioCtx.setSinkId === 'function') {
        try {
            await audioCtx.setSinkId(selectedSpeakerId);
            log("Hoparlör (AudioContext) başarıyla değiştirildi.", "success");
        } catch (err) {
            console.error("AudioContext setSinkId hatası:", err);
            log("AudioContext hoparlör değişimi başarısız. HTML5 fallback deneniyor...", "warning");
            await fallbackSpeakerChange(selectedSpeakerId);
        }
    } else {
        await fallbackSpeakerChange(selectedSpeakerId);
    }
});

async function fallbackSpeakerChange(speakerId) {
    let successCount = 0;
    let failedCount = 0;
    
    const promises = Object.keys(audioElements).map(async connId => {
        const audio = audioElements[connId];
        if (audio && typeof audio.setSinkId === 'function') {
            try {
                await audio.setSinkId(speakerId);
                successCount++;
            } catch (err) {
                console.error(`Audio setSinkId hatası (${connId}):`, err);
                failedCount++;
            }
        }
    });
    
    await Promise.all(promises);
    if (failedCount > 0) {
        log(`Hoparlör değişimi tamamlandı (${successCount} başarılı, ${failedCount} başarısız).`, "warning");
    } else {
        log("Hoparlör (HTML5) başarıyla değiştirildi.", "success");
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
        sendToCsharp("set_ptt_key", { vkCode: vkCode, keyName: keyName });
        
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
        pttKeyContainer.style.display = 'block';
        openmicSettingsArea.style.display = 'none';
        setPushToTalkState(false);
    } else {
        pttKeyContainer.style.display = 'none';
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

// Yardımcı Fonksiyonlar
function showStatus(msg, type) {
    connectionStatus.textContent = msg;
    connectionStatus.className = "status-message " + type;
}

function log(msg, type = 'info') {
    console.log(`[${type.toUpperCase()}] ${msg}`);
    sendToCsharp("log", `[${type.toUpperCase()}] ${msg}`);
}

// Giriş/Çıkış sesleri için Oscillator tabanlı chime çalar
async function playChime(isJoin) {
    if (!audioCtx) return;
    try {
        if (audioCtx.state === 'suspended') {
            await audioCtx.resume();
        }
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        const now = audioCtx.currentTime;
        
        if (isJoin) {
            // Yükselen ses chime: C5 -> E5 -> G5
            osc.type = 'sine';
            osc.frequency.setValueAtTime(523.25, now); // C5
            osc.frequency.setValueAtTime(659.25, now + 0.07); // E5
            osc.frequency.setValueAtTime(783.99, now + 0.14); // G5
            
            gainNode.gain.setValueAtTime(0, now);
            gainNode.gain.linearRampToValueAtTime(0.12, now + 0.03);
            gainNode.gain.setValueAtTime(0.12, now + 0.20);
            gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
            
            osc.start(now);
            osc.stop(now + 0.33);
        } else {
            // Düşen ses chime: G5 -> E5 -> C5
            osc.type = 'sine';
            osc.frequency.setValueAtTime(783.99, now); // G5
            osc.frequency.setValueAtTime(659.25, now + 0.07); // E5
            osc.frequency.setValueAtTime(523.25, now + 0.14); // C5
            
            gainNode.gain.setValueAtTime(0, now);
            gainNode.gain.linearRampToValueAtTime(0.12, now + 0.03);
            gainNode.gain.setValueAtTime(0.12, now + 0.20);
            gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
            
            osc.start(now);
            osc.stop(now + 0.33);
        }
    } catch (e) {
        console.error("Ses çalma hatası:", e);
    }
}

// Mikrofon Testi Dinleyicisi
btnTestMic.addEventListener('click', toggleMicTest);

async function toggleMicTest() {
    if (isTestingMic) {
        // Durdur
        isTestingMic = false;
        btnTestMic.classList.remove('active');
        testMicText.textContent = "Mikrofonu Test Et";
        micTestContainer.style.display = 'none';

        if (testAnimationId) {
            cancelAnimationFrame(testAnimationId);
            testAnimationId = null;
        }

        if (testStream) {
            testStream.getTracks().forEach(track => track.stop());
            testStream = null;
        }

        if (testAudioCtx) {
            testAudioCtx.close();
            testAudioCtx = null;
        }
        testAnalyser = null;
    } else {
        // Başlat
        try {
            const constraints = { audio: true, video: false };
            if (selectedMicId) {
                constraints.audio = { deviceId: { exact: selectedMicId } };
            }
            testStream = await navigator.mediaDevices.getUserMedia(constraints);

            testAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
            testAnalyser = testAudioCtx.createAnalyser();
            testAnalyser.fftSize = 256;

            const source = testAudioCtx.createMediaStreamSource(testStream);
            source.connect(testAnalyser);
            // Hoparlöre bağlamıyoruz (feedback'i önlemek için sadece görsel yapıyoruz)

            isTestingMic = true;
            btnTestMic.classList.add('active');
            testMicText.textContent = "Testi Durdur";
            micTestContainer.style.display = 'flex';

            const dataArray = new Uint8Array(testAnalyser.frequencyBinCount);
            
            function drawMeter() {
                if (!isTestingMic) return;
                testAnalyser.getByteFrequencyData(dataArray);

                let sum = 0;
                for (let i = 0; i < dataArray.length; i++) {
                    sum += dataArray[i];
                }
                const average = sum / dataArray.length;
                // Ses seviyesini 0-100 arasına ölçekle (ortalama genlik ~0-100 arasındadır)
                const percent = Math.min(100, Math.round((average / 100) * 100));

                micTestFill.style.width = percent + '%';
                testAnimationId = requestAnimationFrame(drawMeter);
            }

            drawMeter();
        } catch (err) {
            console.error("Mikrofon testi başlatılamadı:", err);
            alert("Mikrofona erişilemedi: " + err.message);
        }
    }
}

// Yazılı Sohbet İşlemleri
btnToggleChat.addEventListener('click', () => {
    chatPanel.classList.toggle('collapsed');
});

chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const message = chatInput.value.trim();

    // Hem mesaj hem de görsel yoksa hiçbir şey yapma
    if (!message && !stagedImageBase64) return;

    if (connection && connection.state === signalR.HubConnectionState.Connected) {
        try {
            // Önce önizlemedeki görseli gönder
            if (stagedImageBase64) {
                await connection.invoke("SendChatImage", stagedImageBase64);
                // Önizlemeyi temizle
                stagedImageBase64 = null;
                chatPreviewImg.src = '';
                chatPreviewArea.style.display = 'none';
            }

            // Varsa yazılı mesajı gönder
            if (message) {
                await connection.invoke("SendChatMessage", message);
                chatInput.value = '';
            }
            
            chatInput.focus();
        } catch (err) {
            console.error("Gönderim hatası:", err);
            appendSystemMessage("Gönderilemedi: " + err.message);
        }
    } else {
        appendSystemMessage("Bağlantı kesildi, gönderim yapılamaz.");
    }
});

function appendChatMessage(senderId, senderName, text) {
    const isMe = senderId === myConnectionId;
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const msgEl = document.createElement('div');
    msgEl.className = 'chat-message' + (isMe ? ' me' : '');

    msgEl.innerHTML = `
        <div class="chat-message-meta">
            <span class="chat-message-sender">${senderName}</span>
            <span class="chat-message-time">${timeStr}</span>
        </div>
        <div class="chat-message-body">${escapeHtml(text)}</div>
    `;

    chatMessages.appendChild(msgEl);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = '<i class="fa-solid fa-circle-info" style="color: #3b82f6;"></i>';
    if (type === 'success') icon = '<i class="fa-solid fa-circle-check" style="color: #10b981;"></i>';
    if (type === 'error') icon = '<i class="fa-solid fa-circle-xmark" style="color: #ef4444;"></i>';
    if (type === 'warning') icon = '<i class="fa-solid fa-triangle-exclamation" style="color: #f59e0b;"></i>';

    toast.innerHTML = `${icon}<span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 3600);
}

function appendSystemMessage(text) {
    // Sistem uyarılarını chat listesine eklemek yerine daha şık bir Toast olarak gösteriyoruz.
    showToast(text, 'warning');
}

function escapeHtml(str) {
    return str.replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;")
              .replace(/"/g, "&quot;")
              .replace(/'/g, "&#039;");
}

// Görsel Gönderim & Lightbox İşlemleri
btnAttach.addEventListener('click', () => {
    chatFileInput.click();
});

chatFileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        appendSystemMessage("Lütfen geçerli bir resim dosyası seçin.");
        return;
    }

    chatFileInput.value = ''; // Inputu temizle
    await stageImage(file);
});

// Görseli Gönderilmek Üzere Önizlemeye Alır (Staging)
async function stageImage(file) {
    try {
        const compressedBase64 = await compressImage(file);
        stagedImageBase64 = compressedBase64;
        chatPreviewImg.src = compressedBase64;
        chatPreviewArea.style.display = 'flex';
        chatInput.focus();
    } catch (err) {
        console.error("Görsel hazırlama hatası:", err);
        appendSystemMessage("Görsel hazırlanamadı: " + err.message);
    }
}

// Önizlemedeki Görseli Kaldır (İptal)
btnCancelPreview.addEventListener('click', () => {
    stagedImageBase64 = null;
    chatPreviewImg.src = '';
    chatPreviewArea.style.display = 'none';
});

// Kopyala-Yapıştır (Ctrl+V) Desteği
chatInput.addEventListener('paste', async (e) => {
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    for (const item of items) {
        if (item.kind === 'file' && item.type.startsWith('image/')) {
            const file = item.getAsFile();
            if (file) {
                e.preventDefault(); // Resim yapıştırıldığında inputa binary/metin basmasını önle
                await stageImage(file);
            }
        }
    }
});

// Sürükle-Bırak (Drag-and-Drop) Desteği
let dragCounter = 0; // Çocuk elemanların tetiklenmesinde overlay'in titreşmesini engellemek için guard

chatPanel.addEventListener('dragenter', (e) => {
    e.preventDefault();
    dragCounter++;
    chatDragOverlay.classList.add('active');
});

chatPanel.addEventListener('dragover', (e) => {
    e.preventDefault();
});

chatPanel.addEventListener('dragleave', (e) => {
    dragCounter--;
    if (dragCounter === 0) {
        chatDragOverlay.classList.remove('active');
    }
});

chatPanel.addEventListener('drop', async (e) => {
    e.preventDefault();
    dragCounter = 0;
    chatDragOverlay.classList.remove('active');

    const files = e.dataTransfer.files;
    if (files.length > 0) {
        const file = files[0];
        if (file.type.startsWith('image/')) {
            await stageImage(file);
        } else {
            appendSystemMessage("Lütfen geçerli bir resim dosyası bırakın.");
        }
    }
});

function compressImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                const MAX_WIDTH = 1000;
                const MAX_HEIGHT = 1000;

                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                const dataUrl = canvas.toDataURL('image/jpeg', 0.75); // JPEG 0.75 Kalite Sıkıştırma
                resolve(dataUrl);
            };
            img.onerror = (err) => reject(new Error("Görsel yüklenirken hata oluştu."));
            img.src = event.target.result;
        };
        reader.onerror = (err) => reject(new Error("Dosya okunamadı."));
        reader.readAsDataURL(file);
    });
}

function appendChatImage(senderId, senderName, base64Data) {
    const isMe = senderId === myConnectionId;
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const msgEl = document.createElement('div');
    msgEl.className = 'chat-message' + (isMe ? ' me' : '');

    msgEl.innerHTML = `
        <div class="chat-message-meta">
            <span class="chat-message-sender">${senderName}</span>
            <span class="chat-message-time">${timeStr}</span>
        </div>
        <img src="${base64Data}" class="chat-message-image" alt="Shared photo">
    `;

    const img = msgEl.querySelector('.chat-message-image');
    img.addEventListener('click', () => {
        modalImg.src = base64Data;
        imageModal.classList.add('active');
    });

    chatMessages.appendChild(msgEl);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

closeImageViewer.addEventListener('click', () => {
    imageModal.classList.remove('active');
});

imageModal.addEventListener('click', (e) => {
    if (e.target === imageModal || e.target === closeImageViewer) {
        imageModal.classList.remove('active');
    }
});

// Ayarlar Modalı Dinleyicileri
btnSettings.addEventListener('click', () => {
    settingsModal.classList.add('active');
});

btnCloseSettings.addEventListener('click', () => {
    settingsModal.classList.remove('active');
});

settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) {
        settingsModal.classList.remove('active');
    }
});

// Görüntülü Arama & Ekran Paylaşımı İşlemleri
btnCamera.addEventListener('click', async () => {
    if (isSharingCamera) {
        stopCameraShare();
    } else {
        await startCameraShare();
    }
});

btnScreenshare.addEventListener('click', async () => {
    if (isSharingScreen) {
        stopScreenShare();
    } else {
        await startScreenShare();
    }
});

btnFullscreenShare.addEventListener('click', () => {
    if (screenshareVideo.requestFullscreen) {
        screenshareVideo.requestFullscreen();
    } else if (screenshareVideo.webkitRequestFullscreen) {
        screenshareVideo.webkitRequestFullscreen();
    }
});

async function startCameraShare() {
    try {
        log("Kamera paylaşımı başlatılıyor...");
        localCameraStream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 640 },
                height: { ideal: 480 },
                frameRate: { ideal: 20 }
            },
            audio: false // Ses zaten mikrofon akışı (localStream) tarafından yönetiliyor
        });

        isSharingCamera = true;
        btnCamera.classList.add('active');

        // Yerel görüntüyü ızgaraya ekle
        createOrUpdateRemoteVideoElement(myConnectionId, localCameraStream, true);

        // Sunucuyu bilgilendir (Stream ID'yi iletiyoruz)
        if (connection && connection.state === signalR.HubConnectionState.Connected) {
            await connection.invoke("ToggleCameraShare", true, localCameraStream.id);
        }

        // Bağlantıları tazele
        reconnectAllPeers();
        updateVideoLayout();

    } catch (err) {
        console.error("Kamera açılamadı:", err);
        appendSystemMessage("Kamera açılamadı: " + err.message);
        isSharingCamera = false;
        btnCamera.classList.remove('active');
    }
}

function stopCameraShare() {
    if (!isSharingCamera) return;
    log("Kamera paylaşımı durduruluyor...");

    isSharingCamera = false;
    btnCamera.classList.remove('active');

    if (localCameraStream) {
        localCameraStream.getTracks().forEach(track => track.stop());
        localCameraStream = null;
    }

    removeRemoteVideoElement(myConnectionId);

    if (connection && connection.state === signalR.HubConnectionState.Connected) {
        connection.invoke("ToggleCameraShare", false, null).catch(err => console.error(err));
    }

    reconnectAllPeers();
    updateVideoLayout();
}

async function startScreenShare() {
    try {
        log("Ekran paylaşımı başlatılıyor...");
        localScreenStream = await navigator.mediaDevices.getDisplayMedia({
            video: {
                width: { ideal: 1920 },
                height: { ideal: 1080 },
                frameRate: { ideal: 30 }
            },
            audio: false
        });

        isSharingScreen = true;
        btnScreenshare.classList.add('active');

        // Tarayıcı/Sistem ekran paylaşımı durduruldu butonuna basarsa yakala
        localScreenStream.getVideoTracks()[0].onended = () => {
            stopScreenShare();
        };

        // Kendi ekran paylaşımımızı ekranda göster
        screenshareVideo.srcObject = localScreenStream;
        screenshareUsername.textContent = "Ekranınızı paylaşıyorsunuz";
        screenshareContainer.style.display = 'flex';
        activeScreenSharerId = myConnectionId;

        if (connection && connection.state === signalR.HubConnectionState.Connected) {
            await connection.invoke("ToggleScreenShare", true, localScreenStream.id);
        }

        reconnectAllPeers();
        updateVideoLayout();

    } catch (err) {
        console.error("Ekran paylaşımı başlatılamadı:", err);
        isSharingScreen = false;
        btnScreenshare.classList.remove('active');
    }
}

function stopScreenShare() {
    if (!isSharingScreen) return;
    log("Ekran paylaşımı durduruluyor...");

    isSharingScreen = false;
    btnScreenshare.classList.remove('active');

    if (localScreenStream) {
        localScreenStream.getTracks().forEach(track => track.stop());
        localScreenStream = null;
    }

    if (activeScreenSharerId === myConnectionId) {
        activeScreenSharerId = null;
        screenshareContainer.style.display = 'none';
        screenshareVideo.srcObject = null;
    }

    if (connection && connection.state === signalR.HubConnectionState.Connected) {
        connection.invoke("ToggleScreenShare", false, null).catch(err => console.error(err));
    }

    reconnectAllPeers();
    updateVideoLayout();
}

// Ekran ve kamera durumları değiştiğinde tüm peer'ları yeniden bağlar (Mesh renegotiation)
function reconnectAllPeers() {
    log("Tüm webrtc kanalları güncelleniyor, peer'lar yeniden bağlanıyor...");
    const peers = Object.keys(peerConnections);
    peers.forEach(peerId => {
        closePeerConnection(peerId);
        initiateCall(peerId);
    });
}

// Dinamik Video Izgarası (Grid) Yönetim Fonksiyonları
function createOrUpdateRemoteVideoElement(connectionId, stream, isLocal = false) {
    let videoCard = document.getElementById(`videocard-${connectionId}`);
    if (!videoCard) {
        videoCard = document.createElement('div');
        videoCard.className = 'video-card';
        videoCard.id = `videocard-${connectionId}`;

        const video = document.createElement('video');
        video.autoplay = true;
        video.playsInline = true;
        if (isLocal) {
            video.muted = true; // Kendi sesimizin yankı yapmasını önler
        }

        const overlay = document.createElement('div');
        overlay.className = 'video-card-overlay';
        overlay.textContent = isLocal ? "Siz" : (peerConnections[connectionId]?.remoteUsername || "Katılımcı");

        videoCard.appendChild(video);
        videoCard.appendChild(overlay);
        videoGridContainer.appendChild(videoCard);
    }

    const videoEl = videoCard.querySelector('video');
    if (videoEl && videoEl.srcObject !== stream) {
        videoEl.srcObject = stream;
    }
}

function removeRemoteVideoElement(connectionId) {
    const videoCard = document.getElementById(`videocard-${connectionId}`);
    if (videoCard) {
        const videoEl = videoCard.querySelector('video');
        if (videoEl) videoEl.srcObject = null;
        videoCard.remove();
    }
}

// Video Arayüzünün Duruma Göre Şekillenmesi (Grid vs Row)
function updateVideoLayout() {
    const hasActiveCamera = isSharingCamera || Object.values(peerConnections).some(pc => pc.isSharingCamera);
    const hasActiveScreenShare = activeScreenSharerId !== null;
    const voiceDashboard = document.getElementById('voice-dashboard');

    if (!hasActiveCamera && !hasActiveScreenShare) {
        videoGridContainer.style.display = 'none';
        screenshareContainer.style.display = 'none';
        if (voiceDashboard) {
            voiceDashboard.style.display = 'flex';
        }
        return;
    }

    // Video aktifse ses dashboard'unu (mikrofon dalgalarını vs.) gizleyelim ki yer açsın
    if (voiceDashboard) {
        voiceDashboard.style.display = 'none';
    }

    if (hasActiveScreenShare) {
        screenshareContainer.style.display = 'flex';
        
        if (hasActiveCamera) {
            videoGridContainer.style.display = 'flex';
            videoGridContainer.className = 'video-grid-container row-layout';
        } else {
            videoGridContainer.style.display = 'none';
        }
    } else {
        screenshareContainer.style.display = 'none';
        videoGridContainer.style.display = 'grid';
        videoGridContainer.className = 'video-grid-container grid-only';
    }
}
