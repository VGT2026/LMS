# Superadmin API (frontend reference)

Base path: `/api/auth`  
All responses use `{ success, data?, message?, error? }` (same as `authAPI.createInstructor`).

JWT payload includes `role`: `student` | `instructor` | `admin` | `superadmin`.  
`GET /api/auth/profile` returns the user object with `role`.

## Authorization rules

| Actor | Create admin (`POST /superadmin/admin`) | PATCH role → `admin` | PATCH role → `superadmin` | Admin dashboard (`requireAdmin` routes) |
|-------|----------------------------------------|------------------------|---------------------------|----------------------------------------|
| superadmin | Yes | Yes | Yes | Yes |
| admin | No (403) | No (403) | No (403) | Yes |
| instructor / student | No | No | No | No |

`POST /api/auth/admin/instructor` — **admin** or **superadmin**.

## Bootstrap superadmin

Set in `.env` (also applied on `npm run db:migrate` and server start):

```env
SUPERADMIN_EMAIL=you@company.com
SUPERADMIN_PASSWORD=ChangeMe123
SUPERADMIN_NAME=Platform Superadmin
```

## Endpoints

### POST `/api/auth/superadmin/admin`

**Auth:** Bearer token, role `superadmin`  
**Rate limit:** 5 requests / 15 min per IP (configurable via `SUPERADMIN_CREATE_ADMIN_MAX`)

**Body:**
```json
{
  "name": "Jane Admin",
  "email": "jane@example.com",
  "password": "SecurePass1"
}
```

**201 Response:**
```json
{
  "success": true,
  "message": "Admin account created successfully",
  "data": {
    "id": 42,
    "name": "Jane Admin",
    "email": "jane@example.com",
    "role": "admin",
    "is_active": true
  }
}
```

**Errors:** `409` email exists, `400` validation, `403` not superadmin.

---

### GET `/api/auth/superadmin/admins`

**Query:** `page`, `limit`, `search` (optional)

**200 Response:**
```json
{
  "success": true,
  "message": "Admins retrieved successfully",
  "data": [ { "id": 42, "name": "...", "email": "...", "role": "admin", "is_active": true } ],
  "pagination": { "page": 1, "limit": 10, "total": 3, "totalPages": 1 }
}
```

Only users with `role=admin` (superadmin accounts are not listed).

---

### PATCH `/api/auth/superadmin/admins/:userId/deactivate`

Toggles `is_active` for an **admin** user only. Cannot target self.

**200 Response:** updated user (no password).

---

### GET `/api/auth/superadmin/stats`

**200 Response:**
```json
{
  "success": true,
  "data": {
    "totalUsers": 120,
    "activeUsers": 115,
    "totalAdmins": 3,
    "totalSuperadmins": 1,
    "totalInstructors": 10,
    "totalStudents": 106,
    "totalCourses": 25,
    "activeCourses": 22,
    "usersByRole": { "student": 106, "instructor": 10, "admin": 3, "superadmin": 1 }
  }
}
```

---

### Existing admin routes (hardened)

- `PATCH /api/auth/admin/users/:id/role` — body `{ "role": "..." }`. Setting `admin` or `superadmin` requires **superadmin** token (403 for plain admin).
- `POST /api/auth/admin/instructor` — **admin** or **superadmin**.

## Login

`POST /api/auth/login` — unchanged; token includes `role`. New admins log in the same way and use `/admin` dashboard APIs.

## Tests

```bash
npm test
```

Runs `src/scripts/runRolePolicyTests.ts` (policy unit tests for 403/201 rules).
