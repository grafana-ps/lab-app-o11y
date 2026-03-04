# Order - .NET ASP.NET Core
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS builder

WORKDIR /app

COPY *.csproj ./
RUN dotnet restore

COPY . ./
RUN dotnet publish -c Release -o out

# Runtime
FROM mcr.microsoft.com/dotnet/aspnet:8.0

WORKDIR /app

COPY --from=builder /app/out ./

ENV PORT=8080
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080

USER app

ENTRYPOINT ["dotnet", "Order.dll"]

