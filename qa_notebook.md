# Mikroservis Soru-Cevap ve Çalışma Defteri

Bu not defteri, eğitimimiz boyunca sorduğun soruları, verdiğim cevapları ve genel çalışma notlarımızı tutacaktır. İstediğin zaman bu dosyadan tekrarlarını yapabilirsin.

---

## 📌 Genel Çalışma Notları
*   **Mikroservislerin Altın Kuralı:** Servislerin kendi veritabanları olmalıdır (Database per Service). Bir servis asla başka bir servisin veritabanına doğrudan bağlanmamalıdır.
*   **Monolitten Geçiş:** Direkt sıfırdan mikroservis ile başlamak yerine, genellikle monolit bir projeyi büyütüp ardından servis sınırlarını belirleyerek mikroservislere bölmek (Strangler Fig Pattern) daha sağlıklıdır.
*   **🚀 .NET Mikroservis Ekosistemi:**
    *   **API Gateway:** YARP (Yet Another Reverse Proxy) - Microsoft'un geliştirdiği yüksek performanslı proxy.
    *   **İletişim:** HTTP/gRPC (Senkron), MassTransit + RabbitMQ (Asenkron/Event-Driven).
    *   **Veri:** EF Core (Entity Framework Core) ile her servise ayrı DB (PostgreSQL - Docker'da çalışan).

---

## 🙋‍♂️ Soru-Cevap Günlüğü

### ❓ Soru 1: Mikroservis projemizde hangi programlama dilini ve çatıyı kullanacağız?
*   **Cevap:** Geliştirme dili olarak **C#**, platform olarak ise **.NET 10** (.NET SDK 10.0.300 yüklü) kullanacağız. Modern Minimal API'ler, YARP API Gateway ve asenkron iletişim için MassTransit gibi modern kütüphanelerden faydalanacağız.

### ❓ Soru 2: Monolitik mimariyi tekrar ele almamız gerekiyor mu?
*   **Cevap:** Hayır, monolitik mimarinin ne olduğunu ve nasıl çalıştığını zaten biliyorsun. Bu yüzden doğrudan mikroservis mimarisinin dağıtık yapısına, servisler arası iletişime, veri tutarlılığı desenlerine (Saga, CQRS) ve canlıya alma süreçlerine odaklanacağız. Bu sayede öğrenme sürecimizi hızlandıracağız.

### ❓ Soru 3: Veritabanı olarak ne kullanacağız?
*   **Cevap:** Docker üzerinde koşan **PostgreSQL** kullanacağız. Şifre olarak `12345678A` belirlendi. Her servis (Product ve Order) bu sunucu üzerinde kendi bağımsız veritabanlarına (`product_db` ve `order_db`) bağlanacaktır. Bu sayede fiziksel veri izolasyonu (Database-per-service) sağlanmış olacaktır.

### ❓ Soru 4: gRPC nedir ve mikroservislerde neden tercih edilir?
*   **Cevap:** **gRPC (Google Remote Procedure Call)**, yüksek performanslı bir iletişim protokolüdür.
    1.  **Protobuf (Protocol Buffers):** Veriyi JSON gibi metin formatında değil, binary (ikili) formatta iletir. Bu, paket boyutunu küçültür ve serileştirme/seri durumdan çıkarma hızını uçurur.
    2.  **HTTP/2:** Tek bir TCP bağlantısı üzerinden birden fazla isteği eşzamanlı taşır (Multiplexing), başlık sıkıştırması yapar ve çift yönlü akışı (streaming) destekler.
    3.  **Sözleşme Tabanlı (Contract-First):** `.proto` dosyaları ile servislerin imzaları netleşir ve .NET, Go, Java gibi dillerde istemci/sunucu kodları otomatik üretilir.
    Mikroservislerin kendi aralarındaki iç senkron iletişimde (Internal Communication) gRPC tercih edilmelidir. Dış dünya (Client/Browser) ile iletişimde ise hala REST/HTTP yaygındır.

### ❓ Soru 5: Mikroservislerde Kimlik Doğrulama (Authentication) mimarisi nasıl kurulur?
*   **Cevap:** Mikroservislerde en yaygın ve güvenli yöntem **Merkezi Geçit Doğrulamasıdır (Edge Authentication)**:
    1.  **Gateway'de Doğrulama:** İstemci (Client) API Gateway üzerinden JWT alarak giriş yapar. Gateway'e gelen her istekte token imzası doğrulanır.
    2.  **Request Transformation (Header Injection):** Gateway, doğruladığı JWT içerisinden kullanıcı ID, ad ve rol bilgilerini (Claims) okur. Bunları giden HTTP isteğine özel başlıklar (örneğin `X-User-Id`, `X-User-Role`) olarak ekler.
    3.  **İç Servislerin Güveni:** İçerideki servisler (Order Service, Product Service vb.) token doğrulama mantığıyla uğraşmaz. Sadece gelen istekteki `X-User-Id` başlığına bakarak işlemi yapan kullanıcıyı tanımlarlar. Bu hem performansı artırır hem de kod karmaşıklığını önler.
    4.  **Güvenlik Çemberi:** İç servislerin dış dünyaya portları kapatılır (sadece API Gateway veya diğer iç servisler erişebilir). Böylece iç network'e sızılmadığı sürece başlıkların (headers) taklit edilmesi önlenir.

### ❓ Soru 6: Asenkron İletişim nedir ve neden Message Broker (Mesaj Aracısı) kullanılır?
*   **Cevap:** **Asenkron İletişimde** bir servis işini tamamlayıp cevabını dönerken, diğer servislerin bu işlemden haberdar olması için bir olay (event) yayınlar (Publish). Bu süreçte alıcı servislerin anlık olarak ayakta veya hızlı olması gerekmez.
    1.  **Gevşek Bağlılık (Loose Coupling):** `OrderService`, `NotificationService`'in nerede olduğunu, hangi dilde yazıldığını veya ayakta olup olmadığını bilmez. Sadece kuyruğa mesaj bırakır.
    2.  **Hata Toleransı (Resilience):** Bildirim servisi çökerse sipariş alma işlemi aksamaz. Mesajlar kuyrukta (RabbitMQ) güvenle bekler. Bildirim servisi açıldığında kaldığı yerden mesajları tüketir (Consume).
    3.  **Yüksek Performans:** Kullanıcı sipariş verdiğinde e-posta gönderilmesini beklemeden anında "Siparişiniz alındı" ekranını görür. Ağır işler arka planda asenkron yürütülür.
    **MassTransit** kütüphanesi, .NET'te bu mimariyi (RabbitMQ, Kafka vb.) yönetmek için kullanılan en popüler soyutlama (abstraction) kütüphanesidir.

### ❓ Soru 7: Gözlemlenebilirlik (Observability) ve Dağıtık İzleme (Distributed Tracing) nedir?
*   **Cevap:** Dağıtık bir mimaride hata ayıklamak çok zordur çünkü bir işlem birden fazla sunucuya dağılmıştır.
    1.  **Trace ID (İzleme Kimliği):** Gateway'e bir istek geldiğinde benzersiz bir `Trace ID` oluşturulur.
    2.  **Yayılım (Propagation):** Bu Trace ID, HTTP başlıkları, gRPC meta verileri veya RabbitMQ mesaj özellikleri üzerinden sonraki servislere otomatik aktarılır.
    3.  **Merkezi Arayüz (Jaeger/Zipkin):** Tüm servisler yaptıkları işlemleri (sorgular, gRPC çağrıları, kuyruk işlemleri) bu ID ile işaretleyerek merkezi bir toplayıcıya gönderir. Jaeger panelinde bu ID aratıldığında, isteğin tüm servislerdeki milisaniye cinsinden grafiği ve nerede hata aldığı şematik olarak gösterilir.
    4.  **OpenTelemetry:** .NET, Go, Java vb. tüm dillerde bu izleri (traces), metrikleri (metrics) ve logları toplamak için kullanılan dünya standardı kütüphane setidir.

### ❓ Soru 8: Hata Toleransı (Resilience) ve Circuit Breaker (Devre Kesici) nedir?
*   **Cevap:** Dağıtık sistemlerde ağ kopmaları veya bir servisin yavaşlaması/çökmesi kaçınılmazdır.
    1.  **Cascading Failure (Zincirleme Çökme):** `OrderService` sipariş alırken yavaşlayan `ProductService`'e gRPC istekleri atıp beklerse, `OrderService`'in tüm thread'leri kilitlenir ve o da çöker.
    2.  **Circuit Breaker (Polly):** Polly gibi kütüphanelerle gRPC istemcisine devre kesici ekleriz. Eğer hedefe atılan isteklerin hata oranı eşiği aşarsa (örn: son 10 istekten 5'i başarısızsa), devre açılır (Open). Bundan sonra gelen istekler hedefe hiç gitmeden anında "hata" döner (Fast Fail). Hedef servis toparlandığında devre otomatik kapanır (Closed).

### ❓ Soru 9: Saga Pattern ve CQRS Nedir?
*   **Cevap:**
    1.  **Saga Pattern:** Dağıtık işlemlerde (birden fazla DB güncellenirken) veri tutarlılığı sağlar. Örneğin: Sipariş oluşturulur (1), Stok rezerve edilir (2), Ödeme alınır (3). Eğer ödemede hata çıkarsa, Saga tetiklenerek önceki adımları tersine çeviren "Compensating Transactions" (stoğu geri bırak, siparişi iptal et) çalıştırır.
    2.  **CQRS (Command Query Responsibility Segregation):** Veriyi yazma (Insert/Update) ve okuma (Select) modellerini ayırır. Okuma performansı kritikse, yazma işlemi ana DB'ye yapılırken arka planda (asenkron event ile) sadece okuma amaçlı optimize edilmiş bir veritabanı (örn: Elasticsearch veya Redis) güncellenir. Okumalar doğrudan bu optimize edilmiş DB'den yapılır.
