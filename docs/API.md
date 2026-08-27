# API & Domain Design

A user can track their job applications through the hiring process.

## Core entities

- **User** — auth, profile
- **Application** — company, role, status, salary range, location, notes, dates

### Status flow

```
Wishlist → Applied → Phone Screen → Interview → Offer → Rejected / Accepted
```

## API resources

All request bodies are validated with Zod. Responses use a consistent error shape
and follow RESTful status-code conventions.

### Auth

| Method & path        | Description                             |
| -------------------- | -------------------------------------- |
| `POST /auth/register` | Create account                         |
| `POST /auth/login`    | Returns access + refresh tokens        |
| `POST /auth/refresh`  | Refresh access token                   |
| `POST /auth/logout`   | Invalidate refresh token               |

### Applications

| Method & path              | Description                                   |
| -------------------------- | -------------------------------------------- |
| `GET /applications`        | List with filtering, sorting, pagination     |
| `POST /applications`       | Create                                       |
| `GET /applications/:id`    | Get one                                      |
| `PATCH /applications/:id`  | Update (status, notes, etc.)                 |
| `DELETE /applications/:id` | Delete                                       |

## Conventions to enforce

- Resource naming: plural nouns, no verbs in paths
- Status codes: `201` on create, `204` on delete, `400` for validation errors,
  `401`/`403` for auth, `404` for missing resources
- Consistent error response shape across every endpoint
- Pagination on all list endpoints
