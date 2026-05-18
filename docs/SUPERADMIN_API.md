# Superadmin API (frontend reference)

Base: `https://lms-production-7308.up.railway.app/api/auth`  
Envelope: `{ success, data?, message?, error? }`

## Roles

`student` | `instructor` | `admin` | `superadmin`

Bootstrap defaults (if env unset): **superadmin@lmspro.com** / **SuperAdmin123!**

---

## POST `/superadmin/admin`

**Auth:** `Authorization: Bearer <superadmin JWT>`

**Body:**
```json
{
  "name": "Jane Admin",
  "email": "jane@example.com",
  "password": "secret12"
}
```

**201:**
```json
{
  "success": true,
  "message": "Admin account created successfully",
  "data": {
    "admin": {
      "id": 42,
      "name": "Jane Admin",
      "email": "jane@example.com",
      "role": "admin",
      "is_active": true,
      "created_at": "2026-05-18T12:00:00.000Z"
    }
  }
}
```

| Status | When |
|--------|------|
| 401 | Missing/invalid token |
| 403 | Not `superadmin` |
| 409 | Email exists |
| 400 | Validation |

Firebase linking is **best-effort**; the DB user is always created for `POST /login`.

---

## GET `/superadmin/admins`

**Query:** `page`, `limit`, `search` (optional)

**200:**
```json
{
  "success": true,
  "data": [
    {
      "id": 42,
      "name": "Jane Admin",
      "email": "jane@example.com",
      "role": "admin",
      "is_active": true,
      "created_at": "2026-05-18T12:00:00.000Z"
    }
  ]
}
```

---

## GET `/superadmin/students`

**Query:** `page`, `limit`, `search` (name or email)

**200:** `data` = array of students + `pagination` object.  
Fields: `id`, `name`, `email`, `role: "student"`, `is_active`, `enrolled` (enrollment count), `preferred_categories`, `completed_course_ids`, `target_job_role_id`, `created_at`, `updated_at`.  
No passwords.

---

## GET `/superadmin/instructors`

Same as students; `role: "instructor"`, `enrolled` = number of courses they teach.

---

## Existing routes (superadmin JWT allowed)

| Route | Purpose |
|-------|---------|
| `GET /admin/users?role=student\|instructor` | Same data via admin list (admin + superadmin) |
| `PATCH /admin/users/:id/toggle-status` | Activate/deactivate student or instructor |
| `POST /admin/instructor` | Create instructor |
| `GET /superadmin/stats` | Platform metrics |

---

## POST `/login`

**Body:** `{ "email", "password" }`

**200:**
```json
{
  "success": true,
  "data": {
    "token": "<jwt>",
    "user": {
      "id": 42,
      "name": "Jane Admin",
      "email": "jane@example.com",
      "role": "admin",
      "is_active": true
    }
  }
}
```

---

## Optional

- `GET /superadmin/stats` — platform metrics
- `POST /superadmin/admins/:userId/sync-firebase` — repair Firebase for an existing admin
- `PATCH /superadmin/admins/:userId/deactivate` — toggle `is_active`

---

## Acceptance tests

```bash
API_BASE_URL=https://lms-production-7308.up.railway.app npm run test:superadmin-acceptance
```
