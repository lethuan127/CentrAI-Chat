# CentrAI-Chat — Bruno API Collection

A complete API collection for [Bruno](https://www.usebruno.com/), an open-source API client.

## Quick Start

1. Install [Bruno](https://www.usebruno.com/downloads)
2. Open Bruno and click **Open Collection**
3. Select this `docs/bruno` directory
4. Choose the **local** environment from the dropdown

## Environments

| Environment | Base URL |
|-------------|----------|
| **local** | `http://localhost:4000/api/v1` |
| **staging** | `https://staging.centrai.example.com/api/v1` |

## Authentication

1. Run the **Auth > Login** request — this auto-saves the `accessToken` to the environment
2. All subsequent requests use `{{accessToken}}` via Bearer auth
3. Run **Auth > Refresh Token** when the access token expires

## Folders

| Folder | Description |
|--------|-------------|
| `health/` | Liveness and readiness checks |
| `auth/` | Register, login, refresh, profile, logout |
| `chat/` | Conversations and messaging |
| `agents/` | Agent CRUD, publish, versions |
| `providers/` | Provider config, models, test connection |
| `admin/` | User management, analytics, audit log, settings |

## Importing to Postman

Bruno collections can be exported to OpenAPI format. Alternatively, import the OpenAPI JSON spec directly from:

```
http://localhost:4000/api/docs-json
```
