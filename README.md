# LMS Backend API

A Node.js/TypeScript backend API for the Learning Management System (LMS) built with Express.js and MySQL.

## Features

- **Authentication & Authorization**: JWT-based authentication with role-based access control
- **User Management**: Support for students, instructors, and administrators
- **Course Management**: Create and manage courses, modules, and lessons
- **Enrollment System**: Track student progress and course completion
- **Assignments & Quizzes**: Handle submissions, grading, and assessments
- **Discussion Forums**: Course-based discussion management
- **Certificates**: Generate and manage course completion certificates
- **Analytics**: Track user engagement and course performance

## Tech Stack

- **Runtime**: Node.js
- **Language**: TypeScript
- **Framework**: Express.js
- **Database**: MySQL
- **Authentication**: JWT (JSON Web Tokens)
- **Password Hashing**: bcryptjs
- **Rate Limiting**: express-rate-limit
- **Security**: Helmet, CORS
- **Validation**: express-validator

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- MySQL (v8.0 or higher)
- npm or yarn

### Installation

1. **Clone the repository and navigate to backend directory**
   ```bash
   cd LMS_Backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   ```bash
   cp .env.example .env
   ```

   Update the `.env` file with your database credentials and other configuration:
   ```env
   PORT=3001
   NODE_ENV=development
   DB_HOST=localhost
   DB_PORT=3306
   DB_NAME=lms_database
   DB_USER=root
   DB_PASSWORD=your_password
   JWT_SECRET=your_super_secret_jwt_key
   ```

4. **Database Setup**
   - Ensure MySQL is running on your system
   - Initialize the database:
   ```bash
   npm run db:init
   ```
   This will create the database and all necessary tables with sample data.

5. **Start the development server**
   ```bash
   npm run dev
   ```

The API will be available at `http://localhost:3001`

## Authentication System

The LMS has three types of users with different authentication flows:

### User Types & Registration
- **Students**: Can register themselves via `/api/auth/register`
- **Instructors**: Created by admin via `/api/auth/admin/instructor`
- **Admin**: Fixed credentials (see server startup logs)

### API Endpoints

#### Public Endpoints
- `POST /api/auth/login` - User authentication (all user types)
- `POST /api/auth/register` - Student registration

#### Protected Endpoints
- `GET /api/auth/profile` - Get current user profile

#### Admin Endpoints (Require admin role)
- `POST /api/auth/admin/instructor` - Create instructor account
- `GET /api/auth/admin/users` - Get all users with pagination

### Health Check
- `GET /health` - API health status

## Project Structure

```
src/
├── config/          # Database and configuration files
├── controllers/     # Route handlers
├── middleware/      # Express middleware
├── models/          # Database models (to be implemented)
├── routes/          # API routes
├── types/           # TypeScript type definitions
├── utils/           # Utility functions
└── server.ts        # Application entry point
```

## Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build the application for production
- `npm start` - Start the production server
- `npm test` - Run tests (to be implemented)

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 3001 |
| `NODE_ENV` | Environment | development |
| `DB_HOST` | Database host | localhost |
| `DB_PORT` | Database port | 3306 |
| `DB_NAME` | Database name | lms_database |
| `DB_USER` | Database user | root |
| `DB_PASSWORD` | Database password | (empty) |
| `JWT_SECRET` | JWT signing secret | (required) |
| `JWT_EXPIRES_IN` | JWT expiration time | 7d |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window | 900000 |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window | 100 |
| `CORS_ORIGIN` | CORS allowed origin | http://localhost:5173 |

## API Response Format

All API responses follow this format:

```json
{
  "success": true,
  "data": { ... },
  "message": "Operation successful",
  "pagination": { ... } // Only for paginated responses
}
```

Error responses:

```json
{
  "success": false,
  "message": "Error message",
  "error": "Detailed error (development only)"
}
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the ISC License.