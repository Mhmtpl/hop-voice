using Grpc.Core;
using MicroservicesDemo.Grpc;
using ProductService.Data;

namespace ProductService.Services;

public class ProductGrpcService : ProductGrpc.ProductGrpcBase
{
    private readonly ProductDbContext _dbContext;

    public ProductGrpcService(ProductDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public override async Task<ProductResponse> GetProductById(GetProductRequest request, ServerCallContext context)
    {
        if (!Guid.TryParse(request.Id, out var productId))
        {
            throw new RpcException(new Status(StatusCode.InvalidArgument, "Geçersiz Guid formatı."));
        }

        var product = await _dbContext.Products.FindAsync(productId);
        if (product == null)
        {
            throw new RpcException(new Status(StatusCode.NotFound, $"Ürün bulunamadı: ID = {request.Id}"));
        }

        return new ProductResponse
        {
            Id = product.Id.ToString(),
            Name = product.Name,
            Price = (double)product.Price,
            Stock = product.Stock
        };
    }
}
