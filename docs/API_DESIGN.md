# LMS Backend API Design

Based on frontend code review – backend is designed to support these requirements.

---

## 1. Auth APIs

### 1.1 POST `/api/auth/login`
**Frontend:** AuthContext, Login page  
**Request:** `{ email, password }`  
**Response:** `{ success, data: { user: { id, name, email, role, avatar }, token }, message }`  
**Status:** ✅ Implemented

### 1.2 POST `/api/auth/register`
**Frontend:** Register page  
**Request:** `{ name, email, password, confirmPassword, role }`  
**Response:** `{ success, data: { user, token }, message }`  
**Status:** ✅ Implemented

### 1.3 GET `/api/auth/profile`
**Frontend:** dashboardAPI, AuthContext  
**Headers:** `Authorization: Bearer <token>`  
**Response:** `{ success, data: { id, name, email, role, avatar, preferred_categories, completed_course_ids, target_job_role_id, is_active }, message }`  
**Status:** ✅ Implemented  
**Note:** Frontend expects `completedCourseIds` (camelCase) – profile returns snake_case. Frontend uses `profile.data.completedCourseIds` – ensure backend returns `completed_course_ids` (frontend may map).

### 1.4 POST `/api/auth/admin/instructor`
**Frontend:** AdminUsers (Create Instructor)  
**Request:** `{ name, email, password }`  
**Response:** `{ success, data: { instructor: { id, name, email, role, ... } }, message }`  
**Status:** ✅ Implemented

### 1.5 GET `/api/auth/admin/users`
**Frontend:** AdminUsers, AdminCreateCourse, AdminCourses  
**Query:** `page`, `limit`, `role`, `search`  
**Response:** `{ success, data: User[], message, pagination: { page, limit, total, totalPages } }`  
**User shape:** `{ id, name, email, role, is_active, avatar }`  
**Status:** ✅ Implemented

### 1.6 GET `/api/auth/admin/instructors`
**Frontend:** api.ts (authAPI.getInstructors) – may be unused if using getAllUsers with role filter  
**Response:** `{ success, data: Instructor[], message }`  
**Status:** ✅ Implemented

### 1.7 PATCH `/api/auth/admin/users/:id/toggle-status`
**Frontend:** AdminUsers  
**Response:** `{ success, data: User, message }`  
**Status:** ✅ Implemented

### 1.8 PATCH `/api/auth/admin/users/:id/role`
**Frontend:** AdminUsers  
**Request:** `{ role: 'student' | 'instructor' | 'admin' }`  
**Response:** `{ success, data: User, message }`  
**Status:** ✅ Implemented

---

## 2. Course APIs

### 2.1 GET `/api/courses`
**Frontend:** Dashboard, Courses, AdminCourses, InstructorCourses, dashboardAPI  
**Query:** `page`, `limit`, `category`, `search`, `instructor_id`  
**Response:** `{ success, data: Course[], message, pagination }`  
**Course shape:** `{ id, title, description, category, instructor_id, instructor (name), thumbnail, duration, price, level, is_active, students?, progress?, modules? }`  
**Status:** ✅ Implemented (add `instructor_id` query support)  
**Gap:** Backend supports `instructor_id`; frontend courseAPI must pass it.

### 2.2 GET `/api/courses/:id`
**Frontend:** CourseDetail (when connected), InstructorCourseDetail  
**Response:** `{ success, data: Course, message }`  
**Course for detail:** `{ id, title, description, category, instructor, thumbnail, duration, modules: [{ id, title, lessons }], students }`  
**Status:** ✅ Implemented  
**Gap:** Backend returns basic course; frontend expects `modules` – need course_modules + lessons join.

### 2.3 POST `/api/courses`
**Frontend:** AdminCreateCourse  
**Request:** `{ title, description?, instructor_id, category, thumbnail?, duration?, price?, level? }`  
**Response:** `{ success, data: Course, message }`  
**Status:** ✅ Implemented

### 2.4 PUT `/api/courses/:id`
**Frontend:** AdminCourses (Edit), InstructorCourses (Edit)  
**Request:** `{ title?, description?, category?, instructor_id?, thumbnail? }`  
**Response:** `{ success, data: Course, message }`  
**Status:** ✅ Implemented  
**Note:** Instructors must be allowed to update their own courses (title, description, category, thumbnail). Use `requireInstructorOrAdmin` and restrict instructor_id changes to admin only.

### 2.5 PATCH `/api/courses/:id/assign-instructor`
**Frontend:** AdminCourses  
**Request:** `{ instructor_id: number | null }`  
**Response:** `{ success, data: Course, message }`  
**Status:** ✅ Implemented

### 2.6 PATCH `/api/courses/:id/toggle-status`
**Frontend:** AdminCourses  
**Response:** `{ success, data: Course, message }`  
**Status:** ✅ Implemented

### 2.7 PATCH `/api/courses/:id/publish`
**Admin only.** Publishes a draft course (sets is_active=true).  
**Status:** ✅ Implemented

### 2.8 PATCH `/api/courses/:id/unpublish`
**Admin only.** Unpublishes a course (sets is_active=false, back to draft).  
**Status:** ✅ Implemented

### Course workflow (draft → published)
- **Draft** (is_active=false): Instructor can edit title, description, category, thumbnail; add modules and lessons (videos).
- **Published** (is_active=true): Admin has approved; course is live; instructor cannot edit course details.

---

## 2b. Module & Lesson APIs (Instructor)

### 2b.1 GET `/api/modules/course/:courseId`
**Response:** `{ success, data: Module[] }` – modules with lessons (video_url, etc.).  
**Status:** ✅ Implemented

### 2b.2 POST `/api/modules/course/:courseId`
**Instructor only.** Create module. Body: `{ title, description?, order_index? }`.  
**Status:** ✅ Implemented

### 2b.3 PUT `/api/modules/:moduleId`
**Instructor only.** Update module. Only for draft courses.  
**Status:** ✅ Implemented

### 2b.4 DELETE `/api/modules/:moduleId`
**Instructor only.** Delete module. Only for draft courses.  
**Status:** ✅ Implemented

### 2b.5 POST `/api/modules/:moduleId/lessons`
**Instructor only.** Create lesson. Body: `{ title, content?, video_url?, duration?, is_free?, order_index? }`.  
**Status:** ✅ Implemented

### 2b.6 PUT `/api/modules/lessons/:lessonId`
**Instructor only.** Update lesson (e.g. set video_url).  
**Status:** ✅ Implemented

### 2b.7 DELETE `/api/modules/lessons/:lessonId`
**Instructor only.** Delete lesson.  
**Status:** ✅ Implemented

---

## 3. Dashboard APIs (Frontend-Computed)

**Frontend:** dashboardAPI.getStudentStats, getInstructorStats, getAdminStats  
**Current:** Frontend computes stats from `getProfile` + `getAllCourses` + `getAllUsers`  
**Backend endpoints (implemented):**

| Endpoint | Auth | Response |
|----------|------|----------|
| `GET /api/dashboard/student` | Student | `{ enrolledCourses, inProgress, completed, overallProgress, certificates }` |
| `GET /api/dashboard/instructor` | Instructor | `{ totalCourses, activeCourses, totalStudents, avgProgress }` |
| `GET /api/dashboard/admin` | Admin | `{ totalUsers, activeUsers, totalCourses, activeCourses }` |

**Status:** ✅ Implemented. Frontend can switch from computed stats to these endpoints when ready.

**Other endpoints (for future):**
- `GET /api/enrollments` – list enrollments for current user (student) or for instructor’s courses
- `GET /api/dashboard/student` – `{ enrolledCourses, inProgress, completed, overallProgress, certificates }`
- `GET /api/dashboard/instructor` – `{ totalCourses, activeCourses, totalStudents, avgProgress }`
- `GET /api/dashboard/admin` – `{ totalUsers, activeUsers, totalCourses, activeCourses }`

---

## 4. Data Structures Expected by Frontend

### User
```ts
{ id, name, email, role, avatar?, is_active, status? }
```
- `status`: frontend uses `is_active ? 'active' : 'inactive'`

### Course (list)
```ts
{ id, title, description?, category, instructor_id?, instructor (name), thumbnail?, duration?, is_active, students?, progress?, modules? }
```

### Course (detail)
```ts
{
  id, title, description, category, instructor, thumbnail, duration,
  students, enrolledCount,
  modules: [{
    id, title, description?, lessons,
    lessonDetails: [{ id, title, video_url?, duration? }]
  }]
}
```

---

## 5. Implementation Checklist

| Item | Status | Action |
|------|--------|--------|
| GET /courses?instructor_id= | ✅ | Backend supports |
| PUT /courses/:id for instructors | ✅ | requireInstructorOrAdmin; instructors can update own courses |
| getCourseById with modules | ✅ | findByIdWithModules returns modules + students count |
| Dashboard stats APIs | ✅ | GET /api/dashboard/student, /instructor, /admin |
| Enrollment API | ⏳ | EnrollmentModel exists; add routes when needed |
| User enrolled count | ⏳ | Can add to getAllUsers when needed |

---

## 6. Response Format Standard

All success: `{ success: true, data: T, message?: string }`  
All error: `{ success: false, message: string }`  
Paginated: `{ success: true, data: T[], message?, pagination: { page, limit, total, totalPages } }`
