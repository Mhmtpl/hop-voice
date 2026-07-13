# Yazılım Mühendisliği & AI Terimler Sözlüğü
*(Mülakatlarda ve Teknik Sunumlarda Kendini Doğru İfade Etmen İçin)*

Bu sözlük, son 3 ayda üzerinde çalıştığın projelerdeki (**Emsal, SchoolInfo, hop-voice, AI Ajanları**) pratik deneyimlerini sektörel terimlerle eşleştirmek için hazırlanmıştır.

---

## 📂 1. Mimarî & Backend Terimleri

### Clean Architecture (Temiz Mimari)
* **Nedir:** Kodun veritabanından, arayüzden ve dış servislerden bağımsız, katmanlı bir şekilde yazılmasıdır. Değişiklik yapmayı kolaylaştırır.
* **Senin Projendeki Karşılığı:** `SchoolInfo` ve `Emsal` projelerinde klasörleri `Services`, `Shared`, `Gateways` olarak bölmen.
* **Mülakatta Nasıl Söylersin?:** 
  > *"Projelerimde iş mantığını (Business Logic) dış etkenlerden soyutlamak için **Clean Architecture** prensiplerini uyguladım. Bu sayede kodun test edilebilirliğini ve sürdürülebilirliğini artırdım."*

### Domain-Driven Design - DDD (Etki Alanı Odaklı Tasarım)
* **Nedir:** Yazılımı geliştirirken iş kurallarına ve gerçek hayattaki süreçlere (Domain) odaklanarak kod tasarlama yaklaşımıdır.
* **Senin Projendeki Karşılığı:** Projedeki "Sınıflar", "Aktiviteler", "Ders Programı" gibi kavramları kodda ayrı bağımsız iş modelleri olarak tanımlaman.
* **Mülakatta Nasıl Söylersin?:** 
  > *"Karmaşık iş kurallarını yönetmek için **Domain-Driven Design (DDD)** pratiklerinden faydalandım; modellerimi ve servislerimi domain sınırlarına göre yapılandırdım."*

### Signaling (Sinyalleşme)
* **Nedir:** WebRTC ile ses/görüntü aktarımı başlamadan önce, iki bilgisayarın IP ve bağlantı bilgilerini birbirine iletmek için yaptığı ön görüşme/el sıkışma sürecidir.
* **Senin Projendeki Karşılığı:** `hop-voice` projesinde SignalR kullanarak yazdığın `SignalingHub` sınıfı.
* **Mülakatta Nasıl Söylersin?:** 
  > *"WebRTC bağlantılarının kurulabilmesi için ASP.NET Core SignalR kullanarak gerçek zamanlı bir **Signaling (Sinyalleşme) Hub'ı** geliştirdim."*

---

## 🤖 2. Yapay Zekâ & Ajan (Agent) Teknolojileri

### LLM Orchestration (Büyük Dil Modeli Orkestrasyonu)
* **Nedir:** Yapay zeka modellerini (GPT-4o, Gemini vb.) tek bir soru-cevap için değil, ardışık kararlar alacak, araçları kullanacak ve zincirleme işler yapacak şekilde yönetmektir.
* **Senin Projendeki Karşılığı:** Microsoft Agent Framework (MAF) kullanarak sıfırdan ajanlar tasarlaman.
* **Mülakatta Nasıl Söylersin?:** 
  > *"Microsoft Agent Framework (MAF) kullanarak karmaşık iş süreçlerini otonom olarak yöneten **LLM Orkestrasyon** akışları tasarladım."*

### RAG - Retrieval-Augmented Generation (Bilgi Geri Kazanımıyla Güçlendirilmiş Üretim)
* **Nedir:** Yapay zekaya bilmediği özel verileri (örneğin senin PDF'lerini, okul verilerini) bir veritabanından bulup getirerek, o verilere göre cevap üretmesini sağlama tekniğidir.
* **Senin Projendeki Karşılığı:** Projede okul verilerini veya iş dosyalarını yapay zekaya okutarak doğru cevaplar üretmesini sağlaman.
* **Mülakatta Nasıl Söylersin?:** 
  > *"Modellerin halüsinasyon görmesini engellemek ve güncel verilere erişmesini sağlamak amacıyla **RAG (Retrieval-Augmented Generation)** mimarisini entegre ettim."*

### Agentic Workflows (Ajan Tabanlı İş Akışları)
* **Nedir:** Bir yapay zekanın kendi kendine hedefler belirleyip, internette arama yapıp, hata aldığında kodu düzeltip işlemi tamamlayana kadar durmaması sürecidir.
* **Senin Projendeki Karşılığı:** Büyük alışveriş sitelerindeki indirimleri takip edip otomatik post hazırlayan ajan kurgun.
* **Mülakatta Nasıl Söylersin?:** 
  > *"E-ticaret sitelerindeki fırsatları otonom olarak yakalayıp sosyal medya içeriğine dönüştüren **Ajan tabanlı (Agentic) iş akışları** geliştirdim."*

---

## 💻 3. Arayüz (Frontend) & Entegrasyon Terimleri

### Virtual Host Mapping (Sanal Sunucu Eşlemesi)
* **Nedir:** Yerel HTML/CSS dosyalarını masaüstü uygulamasında açarken güvenlik duvarlarına (CORS vb.) takılmamak için, o dosyaları sanki internetteki gerçek bir siteymiş (örneğin `https://voicechat.local`) gibi uygulamaya yutturmaktır.
* **Senin Projendeki Karşılığı:** WPF `WebView2` içinde `SetVirtualHostNameToFolderMapping` metodunu kullanman.
* **Mülakatta Nasıl Söylersin?:** 
  > *"WebRTC'nin HTTPS zorunluluğunu yerel ortamda aşmak için, WebView2 üzerinde **Virtual Host Mapping** tekniğiyle yerel klasörleri sanal bir domaine eşledim."*

### Global Keyboard Hooking (Küresel Klavye Kancası)
* **Nedir:** Uygulama arka planda simge durumundayken veya kullanıcı başka bir oyundayken bile klavyeden basılan tuşları (Bas-Konuş gibi) Windows seviyesinde yakalayabilmektir.
* **Senin Projendeki Karşılığı:** `GlobalKeyboardHook.cs` dosyasında yazdığın C++ / Win32 API kodları.
* **Mülakatta Nasıl Söylersin?:** 
  > *"Kullanıcı oyundayken bas-konuş özelliğini kesintisiz kullanabilsin diye, Windows alt seviye API'lerini kullanarak **Global Keyboard Hooking** mekanizması yazdım."*

---

## 🐳 4. DevOps & Canlıya Alma (Deployment) Terimleri

### Containerization (Konteynerleştirme)
* **Nedir:** Uygulamanın çalışması için gereken her şeyi (kütüphaneler, işletim sistemi bağımlılıkları) tek bir paket (Docker Image) haline getirip, her sunucuda aynı şekilde çalışmasını sağlamaktır.
* **Senin Projendeki Karşılığı:** Projelerine `Dockerfile` yazıp Docker ile sunucuya atman.
* **Mülakatta Nasıl Söylersin?:** 
  > *"Farklı ortamlardaki (Development/Production) bağımlılık sorunlarını sıfıra indirmek için tüm servislerimi **Docker** kullanarak **containerize** ettim."*

### Production-Ready (Canlıya Geçişe Hazır)
* **Nedir:** Yazılan kodun sadece geliştiricinin bilgisayarında değil, gerçek kullanıcıların kullanabileceği şekilde güvenli, kararlı ve sunucuya yüklenmeye hazır olmasıdır.
* **Senin Projendeki Karşılığı:** `hop-voice` projesindeki hataları (mikrofon kontrolü, ekran küçülünce responsive bozulması) çözüp `.exe` çıktısı alman.
* **Mülakatta Nasıl Söylersin?:** 
  > *"Geliştirdiğim uygulamaları hata analizleri ve performans testlerinden geçirerek **production-ready** (canlıya hazır) hale getirdim ve dağıtımını yaptım."*
