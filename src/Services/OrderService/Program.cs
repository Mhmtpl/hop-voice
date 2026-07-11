using Microsoft.EntityFrameworkCore;
using OrderService.Data;
using OrderService.Models;
using MicroservicesDemo.Grpc;
using Grpc.Core;
using MassTransit;
using Shared.Contracts;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;

var builder = WebApplication.CreateBuilder(args);

// OpenTelemetry Dağıtık İzleme (Distributed Tracing) Konfigürasyonu
builder.Services.AddOpenTelemetry()
    .ConfigureResource(resource => resource.AddService("OrderService"))
    .WithTracing(tracing =>
    {
        tracing
            .AddAspNetCoreInstrumentation()
            .AddHttpClientInstrumentation()
            .AddSource("MassTransit") // MassTransit izleme loglarını ekler
            .AddOtlpExporter(opt =>
            {
                opt.Endpoint = new Uri(builder.Configuration["OtelExporterOtlpEndpoint"] ?? "http://localhost:4317");
            });
    });

// DbContext kaydı ve PostgreSQL veritabanı kullanımı (Her servisin kendi DB'si var)
builder.Services.AddDbContext<OrderDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

// gRPC Client Kaydı (ProductService gRPC Sunucusuna bağlanmak için + Polly Resilience Entegrasyonu)
builder.Services.AddGrpcClient<ProductGrpc.ProductGrpcClient>(options =>
{
    options.Address = new Uri(builder.Configuration["ProductGrpcUrl"] ?? "http://localhost:5093");
})
.AddStandardResilienceHandler();

// MassTransit & RabbitMQ Kaydı (Event Publish etmek için)
builder.Services.AddMassTransit(x =>
{
    x.UsingRabbitMq((context, cfg) =>
    {
        cfg.Host(builder.Configuration["RabbitMqHost"] ?? "localhost", "/", h =>
        {
            h.Username("guest");
            h.Password("guest");
        });
    });
});

builder.Services.AddOpenApi();

var app = builder.Build();

// PostgreSQL veritabanını otomatik oluştur
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<OrderDbContext>();
    db.Database.EnsureCreated();
}

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();

// --- MINIMAL API ENDPOINTS ---

// Tüm siparişleri getir
app.MapGet("/api/orders", async (OrderDbContext db) =>
    await db.Orders.Include(o => o.Items).ToListAsync());

// ID'ye göre sipariş getir
app.MapGet("/api/orders/{id:guid}", async (Guid id, OrderDbContext db) =>
    await db.Orders.Include(o => o.Items).FirstOrDefaultAsync(o => o.Id == id) is Order order 
        ? Results.Ok(order) 
        : Results.NotFound());

// Sipariş oluştur (API Gateway'den gelen X-User-Id ile kimlik doğrulama + gRPC ile ürün kontrolü + RabbitMQ'ya event fırlatma)
app.MapPost("/api/orders", async (Order order, HttpContext httpContext, OrderDbContext db, ProductGrpc.ProductGrpcClient productClient, IPublishEndpoint publishEndpoint) =>
{
    var userIdHeader = httpContext.Request.Headers["X-User-Id"].ToString();
    if (string.IsNullOrEmpty(userIdHeader))
    {
        return Results.Json(new { error = "Bu servise sadece API Gateway üzerinden yetkili erişim sağlanabilir." }, statusCode: 401);
    }

    if (order.Items == null || !order.Items.Any())
    {
        return Results.BadRequest("Sipariş kalemi boş olamaz.");
    }

    // Sipariş veren kullanıcının adını Gateway'den gelen ID ile doldur
    order.CustomerName = $"Kullanıcı ID: {userIdHeader}";

    // Her sipariş kalemindeki ürünü gRPC üzerinden kontrol et
    foreach (var item in order.Items)
    {
        try
        {
            var request = new GetProductRequest { Id = item.ProductId.ToString() };
            var product = await productClient.GetProductByIdAsync(request);

            if (product.Stock < item.Quantity)
            {
                return Results.BadRequest($"Yetersiz stok! Ürün: {product.Name}, Mevcut Stok: {product.Stock}, İstenen Adet: {item.Quantity}");
            }

            // Fiyatı gRPC'den gelen güncel fiyatla güncelle
            item.Price = (decimal)product.Price;
        }
        catch (RpcException ex) when (ex.StatusCode == Grpc.Core.StatusCode.NotFound)
        {
            return Results.BadRequest($"Ürün bulunamadı: ProductId = {item.ProductId}");
        }
        catch (RpcException ex)
        {
            return Results.Problem($"Ürün doğrulanırken gRPC hatası oluştu: {ex.Status.Detail}");
        }
    }

    order.Id = Guid.NewGuid();
    order.CreatedAt = DateTime.UtcNow;
    foreach (var item in order.Items)
    {
        item.Id = Guid.NewGuid();
        item.OrderId = order.Id;
    }

    db.Orders.Add(order);
    await db.SaveChangesAsync();

    // Sipariş oluşturuldu olayını (Event) RabbitMQ'ya fırlatıyoruz!
    await publishEndpoint.Publish<OrderCreatedEvent>(new
    {
        OrderId = order.Id,
        CustomerName = order.CustomerName,
        TotalPrice = order.TotalPrice,
        Items = order.Items.Select(item => new
        {
            ProductId = item.ProductId,
            Quantity = item.Quantity,
            Price = item.Price
        }).ToList()
    });

    return Results.Created($"/api/orders/{order.Id}", order);
});

app.Run();
