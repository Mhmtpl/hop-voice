FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS base
WORKDIR /app
EXPOSE 8080

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
ARG BUILD_CONFIGURATION=Release
WORKDIR /src

# Proje dosyalarını kopyala ve restore et
COPY ["src/Services/ProductService/ProductService.csproj", "src/Services/ProductService/"]
COPY ["src/Protos/product.proto", "src/Protos/"]
RUN dotnet restore "src/Services/ProductService/ProductService.csproj"

# Tüm kodları kopyala ve derle
COPY . .
WORKDIR "/src/src/Services/ProductService"
RUN dotnet build "ProductService.csproj" -c $BUILD_CONFIGURATION -o /app/build

FROM build AS publish
ARG BUILD_CONFIGURATION=Release
RUN dotnet publish "ProductService.csproj" -c $BUILD_CONFIGURATION -o /app/publish /p:UseAppHost=false

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "ProductService.dll"]
