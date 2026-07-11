using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using System.Security.Claims;
using System.IdentityModel.Tokens.Jwt;
using Yarp.ReverseProxy.Transforms;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;

var builder = WebApplication.CreateBuilder(args);

// OpenTelemetry Dağıtık İzleme (Distributed Tracing) Konfigürasyonu
builder.Services.AddOpenTelemetry()
    .ConfigureResource(resource => resource.AddService("YarpApiGateway"))
    .WithTracing(tracing =>
    {
        tracing
            .AddAspNetCoreInstrumentation()
            .AddHttpClientInstrumentation()
            .AddOtlpExporter(opt =>
            {
                opt.Endpoint = new Uri(builder.Configuration["OtelExporterOtlpEndpoint"] ?? "http://localhost:4317");
            });
    });

// JWT Anahtarı (En az 32 karakter olmalıdır)
var key = Encoding.ASCII.GetBytes("SuperSecretSecurityKeyThatIsAtLeast32BytesLong!");

// Kimlik doğrulama servislerini ekle
builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(key),
        ValidateIssuer = false,
        ValidateAudience = false
    };
});

builder.Services.AddAuthorization();

// YARP Reverse Proxy'yi ekle ve gelen JWT'den claims bilgilerini çıkarıp iç servislere header olarak ekle
builder.Services.AddReverseProxy()
    .LoadFromConfig(builder.Configuration.GetSection("ReverseProxy"))
    .AddTransforms(transformBuilderContext =>
    {
        transformBuilderContext.AddRequestTransform(async transformContext =>
        {
            var user = transformContext.HttpContext.User;
            if (user.Identity is { IsAuthenticated: true })
            {
                var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                var userRole = user.FindFirst(ClaimTypes.Role)?.Value;

                if (userId != null)
                {
                    // İç servise giden isteğin başlığına (header) User ID ekliyoruz (istemci taklidini önlemek için önce siliyoruz)
                    transformContext.ProxyRequest.Headers.Remove("X-User-Id");
                    transformContext.ProxyRequest.Headers.Add("X-User-Id", userId);
                }
                if (userRole != null)
                {
                    transformContext.ProxyRequest.Headers.Remove("X-User-Role");
                    transformContext.ProxyRequest.Headers.Add("X-User-Role", userRole);
                }
            }
            await Task.CompletedTask;
        });
    });

var app = builder.Build();

app.UseHttpsRedirection();

// Kimlik doğrulama ve yetkilendirme middleware'lerini ekle (Sıralama önemlidir!)
app.UseAuthentication();
app.UseAuthorization();

// Giriş yapıp JWT Token almak için endpoint (Auth Service simülasyonu)
app.MapPost("/api/auth/login", (LoginModel model) =>
{
    if (model.Username == "admin" && model.Password == "123456")
    {
        var tokenHandler = new JwtSecurityTokenHandler();
        var tokenDescriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(new[]
            {
                new Claim(ClaimTypes.NameIdentifier, "9f4859a2-5813-4a11-b0e6-34d193e2b2f6"), // Örnek User ID
                new Claim(ClaimTypes.Role, "Admin")
            }),
            Expires = DateTime.UtcNow.AddDays(7),
            SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256Signature)
        };
        var token = tokenHandler.CreateToken(tokenDescriptor);
        return Results.Ok(new { Token = tokenHandler.WriteToken(token) });
    }
    return Results.Unauthorized();
});

app.MapReverseProxy();

app.Run();

public record LoginModel(string Username, string Password);
