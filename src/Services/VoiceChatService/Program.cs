using VoiceChatService.Hubs;

var builder = WebApplication.CreateBuilder(args);

// CORS Politikası: İstemcimizin bağlanabilmesi için izin veriyoruz
builder.Services.AddCors(options =>
{
    options.AddPolicy("CorsPolicy", policy =>
    {
        policy.AllowAnyHeader()
              .AllowAnyMethod()
              .SetIsOriginAllowed(_ => true) // Tüm kaynaklara (Origins) izin veriyoruz (Geliştirme aşaması için kolaylık)
              .AllowCredentials();
    });
});

// SignalR Servisini ekle (Resim gönderimi için limiti 5MB yapıyoruz)
builder.Services.AddSignalR(options =>
{
    options.MaximumReceiveMessageSize = 5242880; // 5MB
});

var app = builder.Build();

app.UseCors("CorsPolicy");

app.MapGet("/", () => "VoiceChat Signaling Server is running.");

// Hub rotasını tanımla
app.MapHub<SignalingHub>("/signaling");

app.Run();

