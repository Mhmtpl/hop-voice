FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS base
WORKDIR /app
EXPOSE 80
EXPOSE 8080

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY ["VoiceChatService.csproj", "."]
RUN dotnet restore "./VoiceChatService.csproj"
COPY . .
WORKDIR "/src/."
RUN dotnet build "VoiceChatService.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "VoiceChatService.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "VoiceChatService.dll"]
