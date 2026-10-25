# Cryptographic Audit Chain Specification

ResidueGuard implements a hash chain inspired by blockchain architecture, optimized for a lightweight browser environment.

## Data Schema
Every spray event generates a JSON payload:
```json
{
  "eventId": "uuid-v4",
  "sequence": 1,
  "timestamp": "2026-10-21T10:00:00Z",
  "eventType": "spray_logged",
  "payload": {
    "lotId": "RG-GRA-AZOX-10",
    "crop": "Grapes",
    "chemical": "Azoxystrobin",
    "dose": 1.5,
    "daysToHarvest": 10
  }
}
