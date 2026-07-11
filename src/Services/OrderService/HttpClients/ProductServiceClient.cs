using System.Net.Http.Json;
using OrderService.DTOs;

namespace OrderService.HttpClients;

public class ProductServiceClient
{
    private readonly HttpClient _httpClient;

    public ProductServiceClient(HttpClient httpClient)
    {
        _httpClient = httpClient;
    }

    public async Task<ProductDto?> GetProductAsync(Guid productId)
    {
        try
        {
            var response = await _httpClient.GetAsync($"/api/products/{productId}");
            if (response.IsSuccessStatusCode)
            {
                return await response.Content.ReadFromJsonAsync<ProductDto>();
            }
            return null;
        }
        catch
        {
            // Gerçek projede loglanır, şimdilik null dönelim
            return null;
        }
    }
}
