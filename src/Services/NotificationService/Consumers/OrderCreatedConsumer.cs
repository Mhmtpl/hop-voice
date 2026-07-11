using MassTransit;
using Shared.Contracts;

namespace NotificationService.Consumers;

public class OrderCreatedConsumer : IConsumer<OrderCreatedEvent>
{
    private readonly ILogger<OrderCreatedConsumer> _logger;

    public OrderCreatedConsumer(ILogger<OrderCreatedConsumer> logger)
    {
        _logger = logger;
    }

    public async Task Consume(ConsumeContext<OrderCreatedEvent> context)
    {
        var message = context.Message;
        _logger.LogInformation("🔔 [NotificationService] YENİ SİPARİŞ BİLDİRİMİ ALINDI!");
        _logger.LogInformation("Sipariş ID: {OrderId}", message.OrderId);
        _logger.LogInformation("Müşteri: {CustomerName}", message.CustomerName);
        _logger.LogInformation("Toplam Tutar: {TotalPrice} TL", message.TotalPrice);
        _logger.LogInformation("Kalem sayısı: {Count}", message.Items.Count);

        // Gerçekte burada e-posta veya SMS gönderme kodları olur.
        await Task.CompletedTask;
    }
}
