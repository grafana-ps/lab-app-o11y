using System.Text.Json;

var builder = WebApplication.CreateBuilder(args);

var port = Environment.GetEnvironmentVariable("PORT") ?? "8080";
var paymentUrl = Environment.GetEnvironmentVariable("PAYMENT_URL") ?? "http://payment:8080";
var serviceName = Environment.GetEnvironmentVariable("OTEL_SERVICE_NAME") ?? "order";

builder.WebHost.UseUrls($"http://0.0.0.0:{port}");

// Configure JSON console logging
builder.Logging.ClearProviders();
builder.Logging.AddJsonConsole(options =>
{
    options.TimestampFormat = "yyyy-MM-ddTHH:mm:ss.fffZ";
    options.UseUtcTimestamp = true;
});

var app = builder.Build();
var logger = app.Services.GetRequiredService<ILogger<Program>>();

var httpClient = new HttpClient { Timeout = TimeSpan.FromSeconds(10) };
var random = new Random();

// Structured log helper
void LogStructured(LogLevel level, string message, Dictionary<string, object>? extra = null)
{
    var scope = new Dictionary<string, object> { ["service"] = serviceName };
    if (extra != null)
    {
        foreach (var kvp in extra) scope[kvp.Key] = kvp.Value;
    }
    using (logger.BeginScope(scope))
    {
        logger.Log(level, message);
    }
}

// Health check
app.MapGet("/health", () => Results.Json(new { status = "healthy", service = "order" }));

// Order check endpoint
app.MapGet("/orders/check", async (HttpContext context) =>
{
    var slow = context.Request.Query["slow"] == "true";
    var triggerError = context.Request.Query["error"] == "true";
    var requestId = Guid.NewGuid().ToString("N")[..8];
    var orderId = Guid.NewGuid().ToString("N")[..8];

    LogStructured(LogLevel.Information, "Processing order check request", new Dictionary<string, object>
    {
        ["request_id"] = requestId,
        ["order_id"] = orderId,
        ["slow"] = slow,
        ["error"] = triggerError,
        ["client_ip"] = context.Connection.RemoteIpAddress?.ToString() ?? "unknown"
    });

    // Simulate order validation
    var orderAmount = random.Next(10, 500);
    LogStructured(LogLevel.Information, "Validating order details", new Dictionary<string, object>
    {
        ["request_id"] = requestId,
        ["order_id"] = orderId,
        ["order_amount"] = orderAmount,
        ["currency"] = "USD"
    });

    // Check for high-value orders
    if (orderAmount > 300)
    {
        LogStructured(LogLevel.Warning, "High-value order requires additional verification", new Dictionary<string, object>
        {
            ["request_id"] = requestId,
            ["order_id"] = orderId,
            ["order_amount"] = orderAmount,
            ["threshold"] = 300
        });
    }

    // Optional simulated delay
    if (slow)
    {
        var delay = random.Next(100, 400);
        LogStructured(LogLevel.Warning, "Slow request mode - adding artificial latency", new Dictionary<string, object>
        {
            ["request_id"] = requestId,
            ["delay_ms"] = delay
        });
        await Task.Delay(delay);
    }

    try
    {
        // Build downstream URL
        var downstreamUrl = $"{paymentUrl}/payment/validate";
        var queryParams = new List<string>();
        if (slow) queryParams.Add("slow=true");
        if (triggerError) queryParams.Add("error=true");
        if (queryParams.Count > 0)
        {
            downstreamUrl += "?" + string.Join("&", queryParams);
        }

        LogStructured(LogLevel.Information, "Calling payment service for validation", new Dictionary<string, object>
        {
            ["request_id"] = requestId,
            ["order_id"] = orderId,
            ["payment_url"] = paymentUrl
        });

        var stopwatch = System.Diagnostics.Stopwatch.StartNew();
        var response = await httpClient.GetAsync(downstreamUrl);
        stopwatch.Stop();
        var content = await response.Content.ReadAsStringAsync();

        if ((int)response.StatusCode >= 400)
        {
            LogStructured(LogLevel.Warning, "Payment service returned error status", new Dictionary<string, object>
            {
                ["request_id"] = requestId,
                ["order_id"] = orderId,
                ["status_code"] = (int)response.StatusCode,
                ["duration_ms"] = stopwatch.ElapsedMilliseconds
            });
        }
        else
        {
            LogStructured(LogLevel.Information, "Payment validation successful", new Dictionary<string, object>
            {
                ["request_id"] = requestId,
                ["order_id"] = orderId,
                ["status_code"] = (int)response.StatusCode,
                ["duration_ms"] = stopwatch.ElapsedMilliseconds
            });
        }

        var result = new
        {
            service = "order",
            order_id = orderId,
            status = (int)response.StatusCode == 200 ? "pending_payment" : "payment_failed",
            downstream = JsonSerializer.Deserialize<object>(content)
        };

        return Results.Json(result, statusCode: (int)response.StatusCode == 200 ? 200 : (int)response.StatusCode);
    }
    catch (TaskCanceledException)
    {
        LogStructured(LogLevel.Error, "Payment service request timed out", new Dictionary<string, object>
        {
            ["request_id"] = requestId,
            ["order_id"] = orderId,
            ["payment_url"] = paymentUrl,
            ["timeout_seconds"] = 10
        });
        return Results.Json(new
        {
            service = "order",
            order_id = orderId,
            error = "Payment service timeout",
            message = "Request timed out after 10 seconds"
        }, statusCode: 504);
    }
    catch (Exception ex)
    {
        LogStructured(LogLevel.Error, "Failed to call payment service", new Dictionary<string, object>
        {
            ["request_id"] = requestId,
            ["order_id"] = orderId,
            ["error"] = ex.Message,
            ["payment_url"] = paymentUrl
        });
        return Results.Json(new
        {
            service = "order",
            order_id = orderId,
            error = "Failed to reach payment service",
            message = ex.Message
        }, statusCode: 502);
    }
});

LogStructured(LogLevel.Information, "Order service starting", new Dictionary<string, object>
{
    ["port"] = port,
    ["payment_url"] = paymentUrl
});

app.Run();
