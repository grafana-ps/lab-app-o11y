package com.demo.payment;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import jakarta.servlet.http.HttpServletRequest;
import java.util.HashMap;
import java.util.Map;
import java.util.Random;
import java.util.UUID;

@SpringBootApplication
@RestController
public class PaymentApplication {

    private static final Logger logger = LoggerFactory.getLogger(PaymentApplication.class);
    private final Random random = new Random();
    
    // Payment providers for demo variety
    private static final String[] PROVIDERS = {"stripe", "paypal", "square", "adyen"};
    private static final String[] CARD_TYPES = {"visa", "mastercard", "amex", "discover"};

    public static void main(String[] args) {
        logger.info("Payment service initializing...");
        SpringApplication.run(PaymentApplication.class, args);
        logger.info("Payment service started successfully");
    }

    @GetMapping("/health")
    public Map<String, String> health() {
        Map<String, String> response = new HashMap<>();
        response.put("status", "healthy");
        response.put("service", "payment");
        return response;
    }

    @GetMapping("/payment/validate")
    public ResponseEntity<Map<String, Object>> validatePayment(
            @RequestParam(value = "slow", defaultValue = "false") boolean slow,
            @RequestParam(value = "error", defaultValue = "false") boolean triggerError,
            HttpServletRequest request) throws InterruptedException {

        String requestId = UUID.randomUUID().toString().substring(0, 8);
        String transactionId = UUID.randomUUID().toString().substring(0, 8);
        String provider = PROVIDERS[random.nextInt(PROVIDERS.length)];
        String cardType = CARD_TYPES[random.nextInt(CARD_TYPES.length)];
        double amount = 10 + random.nextDouble() * 490;
        
        // Set MDC for structured logging
        MDC.put("request_id", requestId);
        MDC.put("transaction_id", transactionId);
        
        try {
            logger.info("Processing payment validation request - requestId={}, slow={}, error={}, clientIp={}", 
                requestId, slow, triggerError, request.getRemoteAddr());
            
            logger.info("Payment details - transactionId={}, provider={}, cardType={}, amount={}", 
                transactionId, provider, cardType, String.format("%.2f", amount));
            
            // Check for high-risk transaction
            if (amount > 400) {
                logger.warn("High-risk transaction detected - transactionId={}, amount={}, threshold=400", 
                    transactionId, String.format("%.2f", amount));
            }
            
            // Fraud check simulation
            int fraudScore = random.nextInt(100);
            if (fraudScore > 80) {
                logger.warn("Elevated fraud score detected - transactionId={}, fraudScore={}, threshold=80", 
                    transactionId, fraudScore);
            } else {
                logger.info("Fraud check passed - transactionId={}, fraudScore={}", transactionId, fraudScore);
            }
            
            // Optional simulated delay
            if (slow) {
                int delay = 100 + random.nextInt(300);
                logger.warn("Slow request mode - adding artificial latency - requestId={}, delayMs={}", requestId, delay);
                Thread.sleep(delay);
            }
            
            // Simulated error for demo
            if (triggerError) {
                logger.error("Payment declined - transactionId={}, provider={}, reason=INSUFFICIENT_FUNDS, cardType={}", 
                    transactionId, provider, cardType);
                
                Map<String, Object> errorResponse = new HashMap<>();
                errorResponse.put("service", "payment");
                errorResponse.put("transaction_id", transactionId);
                errorResponse.put("error", "Payment validation failed");
                errorResponse.put("code", "PAYMENT_DECLINED");
                errorResponse.put("reason", "INSUFFICIENT_FUNDS");
                errorResponse.put("message", "Simulated error for demo purposes");
                return ResponseEntity.status(HttpStatus.PAYMENT_REQUIRED).body(errorResponse);
            }
            
            // Log successful authorization
            logger.info("Payment authorized successfully - transactionId={}, provider={}, amount={}, cardType={}", 
                transactionId, provider, String.format("%.2f", amount), cardType);
            
            // Randomly log payment gateway latency warnings
            int gatewayLatency = random.nextInt(500);
            if (gatewayLatency > 300) {
                logger.warn("Payment gateway response slow - transactionId={}, provider={}, latencyMs={}", 
                    transactionId, provider, gatewayLatency);
            }

            // Success response
            Map<String, Object> response = new HashMap<>();
            response.put("service", "payment");
            response.put("transaction_id", transactionId);
            response.put("status", "validated");
            response.put("provider", provider);
            response.put("card_type", cardType);
            response.put("amount", String.format("%.2f", amount));
            response.put("currency", "USD");
            response.put("timestamp", System.currentTimeMillis());
            
            logger.info("Payment validation completed - transactionId={}, status=validated", transactionId);

            return ResponseEntity.ok(response);
            
        } finally {
            MDC.clear();
        }
    }
}
