using MassTransit;
using NotificationService.Consumers;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;

var builder = Host.CreateApplicationBuilder(args);

// OpenTelemetry Dağıtık İzleme (Distributed Tracing) Konfigürasyonu
builder.Services.AddOpenTelemetry()
    .ConfigureResource(resource => resource.AddService("NotificationService"))
    .WithTracing(tracing =>
    {
        tracing
            .AddSource("MassTransit") // MassTransit tüketim loglarını izlemek için
            .AddOtlpExporter(opt =>
            {
                opt.Endpoint = new Uri(builder.Configuration["OtelExporterOtlpEndpoint"] ?? "http://localhost:4317");
            });
    });

// MassTransit & RabbitMQ Kaydı (Consumer olarak)
builder.Services.AddMassTransit(x =>
{
    // Consumer'ımızı ekliyoruz
    x.AddConsumer<OrderCreatedConsumer>();

    x.UsingRabbitMq((context, cfg) =>
    {
        cfg.Host(builder.Configuration["RabbitMqHost"] ?? "localhost", "/", h =>
        {
            h.Username("guest");
            h.Password("guest");
        });

        // Kuyruğu ve Consumer bağlantısını otomatik yapılandırır
        cfg.ConfigureEndpoints(context);
    });
});

var host = builder.Build();
host.Run();
