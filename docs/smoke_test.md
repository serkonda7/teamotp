```bash
# Add entry
curl -X POST http://localhost:3000/api/otp -H "Content-Type: application/json" -d '{"label": "Plain Entry", "issuer": "me", "secret": "PLAINSECRET123"}'

# Get entries
curl -X GET http://localhost:3000/api/otp
```
