using Microsoft.EntityFrameworkCore;
using ProductService.Data;
using ProductService.Models;
using ProductService.Services;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;

var builder = WebApplication.CreateBuilder(args);

// OpenTelemetry Dağıtık İzleme (Distributed Tracing) Konfigürasyonu
builder.Services.AddOpenTelemetry()
    .ConfigureResource(resource => resource.AddService("ProductService"))
    .WithTracing(tracing =>
    {
        tracing
            .AddAspNetCoreInstrumentation()
            .AddOtlpExporter(opt =>
            {
                opt.Endpoint = new Uri(builder.Configuration["OtelExporterOtlpEndpoint"] ?? "http://localhost:4317");
            });
    });

// DbContext kaydı ve PostgreSQL veritabanı kullanımı (Her servisin kendi DB'si var)
builder.Services.AddDbContext<ProductDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

// gRPC servislerini kaydet
builder.Services.AddGrpc();

builder.Services.AddOpenApi();

var app = builder.Build();

// Uygulama başlarken PostgreSQL veritabanını otomatik oluştur ve ilk verileri ekle (Seed)
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<ProductDbContext>();
    db.Database.EnsureCreated();

    if (!db.Products.Any())
    {
        db.Products.AddRange(
            new Product { Id = Guid.NewGuid(), Name = "Laptop", Price = 15000, Stock = 10 },
            new Product { Id = Guid.NewGuid(), Name = "Akıllı Telefon", Price = 8000, Stock = 20 },
            new Product { Id = Guid.NewGuid(), Name = "Kablosuz Kulaklık", Price = 1200, Stock = 50 }
        );
        db.SaveChanges();
    }
}

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();

// gRPC endpoint'ini haritalandır
app.MapGrpcService<ProductGrpcService>();

// --- MINIMAL API ENDPOINTS ---

// Tüm ürünleri getir
app.MapGet("/api/products", async (ProductDbContext db) =>
    await db.Products.ToListAsync());

// ID'ye göre ürün getir
app.MapGet("/api/products/{id:guid}", async (Guid id, ProductDbContext db) =>
    await db.Products.FindAsync(id) is Product product ? Results.Ok(product) : Results.NotFound());

// Yeni ürün oluştur
app.MapPost("/api/products", async (Product product, ProductDbContext db) =>
{
    product.Id = Guid.NewGuid();
    db.Products.Add(product);
    await db.SaveChangesAsync();
    return Results.Created($"/api/products/{product.Id}", product);
});

// Ürün güncelle
app.MapPut("/api/products/{id:guid}", async (Guid id, Product updatedProduct, ProductDbContext db) =>
{
    var product = await db.Products.FindAsync(id);
    if (product is null) return Results.NotFound();

    product.Name = updatedProduct.Name;
    product.Price = updatedProduct.Price;
    product.Stock = updatedProduct.Stock;

    await db.SaveChangesAsync();
    return Results.NoContent();
});

// Ürün sil
app.MapDelete("/api/products/{id:guid}", async (Guid id, ProductDbContext db) =>
{
    var product = await db.Products.FindAsync(id);
    if (product is null) return Results.NotFound();

    db.Products.Remove(product);
    await db.SaveChangesAsync();
    return Results.NoContent();
});

app.Run();
