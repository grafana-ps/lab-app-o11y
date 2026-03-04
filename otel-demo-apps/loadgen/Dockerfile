# k6 load generator
FROM grafana/k6:latest

WORKDIR /scripts

COPY script.js ./
COPY scenarios/ ./scenarios/

# Default command runs the main script
ENTRYPOINT ["k6"]
CMD ["run", "/scripts/script.js"]

