namespace Shared.Contracts;

public interface OrderCreatedEvent
{
    public Guid OrderId { get; }
    public string CustomerName { get; }
    public decimal TotalPrice { get; }
    public List<OrderCreatedItem> Items { get; }
}

public interface OrderCreatedItem
{
    public Guid ProductId { get; }
    public int Quantity { get; }
    public decimal Price { get; }
}
