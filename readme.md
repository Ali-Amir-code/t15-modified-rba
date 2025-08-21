# Node.js Auth + RBAC API — README

**Overview**
This project is a modular Node.js + Express backend with MongoDB (Mongoose) that implements secure authentication (JWT access & refresh tokens), role-based authorization (`Admin`, `Editor`, `Viewer`), user & profile management, content CRUD, and robust account lifecycle features (email verification, password reset, soft-delete/restore, audit of profile updates). The codebase follows separation of concerns: routes → controllers → models → middleware → utils.

---

## Table of contents

1. Quick start
2. Environment variables (`.env`)
3. Architecture & models (summary)
4. Features (what’s new / changed)
5. Endpoints (full list + examples)
6. Security & behavior notes
7. Admin bootstrap (create first admin)
8. Testing (curl examples & Postman)
9. Production checklist

---

## 1 — Quick start

1. Install:

```bash
git clone https://github.com/ali-amir-code/t15-modified-rba.git
cd t15-modified-rba
npm install
```

2. Copy `.env.sample` → `.env` and fill values (see section 2).

3. Start server:

```bash
npm run dev   # or npm start
```

API base default: `http://localhost:4000/api` (controlled by `BASE_URL` in `.env`).

---

## 2 — Environment variables (`.env`)

Minimum required:

```
PORT=4000
MONGO_URI=mongodb://localhost:27017/auth_rbac_db
JWT_ACCESS_SECRET=strong_random_access_secret
JWT_REFRESH_SECRET=strong_random_refresh_secret
ACCESS_TOKEN_EXPIRES=15m
REFRESH_TOKEN_EXPIRES=7d
BASE_URL=http://localhost:4000
EMAIL_FROM=your@email.com
SMTP_HOST=         # optional for real emails
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
```

* If SMTP\_\* are not set, verification/reset/password-change emails are logged to the server console (development mode).
* Keep secrets out of source control. Use a secret manager in production.

---

## 3 — Architecture & models (summary)

**Folders**

* `models/` — Mongoose models: `User.js`, `Token.js`, `Content.js`
* `routes/` — Express routes: `auth.js`, `profile.js`, `users.js`, `content.js`
* `controllers/` — Controller logic
* `middleware/` — `auth.js` (JWT), `permit.js` (role checks), `errorHandler.js`
* `utils/` — email sender, token helpers
* `scripts/` — optional seed script (create first Admin)

**Key models**

* `User`

  * `name`, `email` (unique), `password` (bcrypt hash)
  * `role`: `Admin` | `Editor` | `Viewer` (default `Viewer`)
  * `emailVerified`: boolean
  * `lastLoginAt`, `isDeleted`
  * `profileUpdates`: array of `{field, oldValue, newValue, updatedAt}` for audit/history
* `Token`

  * For `refresh` tokens: `tokenId` (uuid), `user`, `expiresAt`, `revoked`
  * For one-time tokens (`verify`, `reset`): `tokenHash`, `user`, `expiresAt`, `used`
* `Content`

  * `title`, `body`, `author`, `isDeleted`

---

## 4 — Features (what’s new / changed)

* **Profile Management**

  * `GET /api/profile` — return authenticated user profile (no password)
  * `PUT /api/profile` — update name and/or email (email change requires re-verification)
  * Profile updates are recorded into `user.profileUpdates`

* **Password Update**

  * `PUT /api/profile/password` — requires `{ currentPassword, newPassword }`
  * Validates current password with bcrypt
  * Enforces password strength (`isStrongPassword`)
  * Hashes new password with bcrypt
  * Revokes all refresh tokens for the user after change
  * Sends password-change notification email (or logs it in dev)

* **Soft Delete & Restore**

  * `DELETE /api/profile` — user-initiated soft-delete (marks `isDeleted: true`, revokes tokens)
  * Admin can soft-delete another user via `DELETE /api/users/:id`
  * Admin can list soft-deleted users: `GET /api/users?includeDeleted=true`
  * Admin can restore a user: `PUT /api/users/:id/restore`
  * Soft-deleted users cannot log in or access protected routes

* **Auth & Token Management**

  * Short-lived access token (JWT) for requests in `Authorization: Bearer <accessToken>`
  * Long-lived refresh tokens stored server-side for revocation and rotation
  * Token refresh flow issues new access+refresh tokens, revokes old refresh
  * One-time tokens for email verification & password reset are hashed in DB and single-use

* **Audit & Notifications**

  * Profile change history in `profileUpdates`
  * Email notifications on password change and account deactivation (or logged)

---

## 5 — Endpoints (detailed)

> Replace `{{BASE}}` with `http://localhost:4000/api` (or your `BASE_URL`).

All request/response examples are JSON. Protected routes require `Authorization: Bearer <accessToken>` header.

### Auth routes

#### `POST /api/auth/register`

Request:

```json
{
  "name":"Alice",
  "email":"alice@example.com",
  "password":"StrongPass123!"
}
```

Response (201):

```json
{ "message": "Registered. Please check email to verify your account." }
```

Behavior: creates user (role `Viewer`), sends verification email with single-use token.

---

#### `GET /api/auth/verify-email?token=<token>&email=<email>`

Response:

```json
{ "message": "Email verified. You can now login." }
```

Behavior: marks `emailVerified: true` for user if token valid (single-use).

---

#### `POST /api/auth/login`

Request:

```json
{ "email":"alice@example.com","password":"StrongPass123!" }
```

Response (200):

```json
{
  "accessToken": "<jwt-access>",
  "refreshToken": "<jwt-refresh>"
}
```

Notes: login blocked if `emailVerified === false` or `isDeleted === true`.

---

#### `POST /api/auth/token`

Request:

```json
{ "refreshToken": "<refresh_token>" }
```

Response:

```json
{ "accessToken": "<new_access>", "refreshToken": "<new_refresh>" }
```

Behavior: verifies refresh token, checks server-side token document, revokes old token doc, issues new pair.

---

#### `POST /api/auth/logout`

Request:

```json
{ "refreshToken": "<refresh_token>" }
```

Response:

```json
{ "message": "Logged out" }
```

Behavior: marks corresponding refresh token doc `revoked: true`.

---

#### `POST /api/auth/forgot-password`

Request:

```json
{ "email": "alice@example.com" }
```

Response:

```json
{ "message": "If that email exists you will receive a reset link" }
```

Behavior: creates a single-use reset token and emails (or logs) the reset link.

---

#### `POST /api/auth/reset-password`

Request:

```json
{ "token":"<resetToken>","email":"alice@example.com","password":"NewPass123!" }
```

Response:

```json
{ "message":"Password reset successful" }
```

Behavior: validates token, sets new hashed password, marks token used, revokes refresh tokens.

---

### Profile routes (authenticated)

#### `GET /api/profile`

Response:

```json
{
  "_id":"...","name":"Alice","email":"alice@example.com","role":"Viewer",
  "emailVerified":true,"lastLoginAt":"...","isDeleted":false,
  "profileUpdates":[ { "field":"email", "oldValue":"old@x", "newValue":"new@x","updatedAt":"..." } ],
  "createdAt":"...", "updatedAt":"..."
}
```

#### `PUT /api/profile`

Request (partial allowed):

```json
{ "name":"Alice New", "email":"alice.new@example.com" }
```

Response:

```json
{ "message": "Profile updated" }
```

Behavior: if email changes, sets `emailVerified=false`, sends new verification token, records change in `profileUpdates`.

Validation: `name` minimum length, `email` format checked.

---

#### `PUT /api/profile/password`

Request:

```json
{ "currentPassword":"OldPass123!", "newPassword":"NewStrongPass123!" }
```

Response:

```json
{ "message": "Password updated" }
```

Behavior:

* Validates `currentPassword` by comparing bcrypt hash
* Validates new password strength (`isStrongPassword`)
* Hashes & stores new password
* Records a `profileUpdates` audit entry (no raw password stored)
* Revokes all refresh tokens for the user
* Sends password-change notification email

Errors:

* `400` if `currentPassword` incorrect
* `403` if account `isDeleted`

---

#### `DELETE /api/profile`

Request: (no body; authorization required)
Response:

```json
{ "message": "Account deactivated" }
```

Behavior:

* Sets `isDeleted: true`
* Revokes tokens for the user
* Sends account deactivation email
* After this, login attempts are denied and protected routes reject access

---

### User management (Admin-only)

> Protected by `jwtAuth` and `permit("Admin")`

#### `GET /api/users`

* Default: returns only `isDeleted: false` users
* Query `?includeDeleted=true` to return all users including soft-deleted

Response:

```json
[
  { "_id":"...", "name":"Alice", "email":"alice@example.com", "role":"Admin", "isDeleted":false, ... },
  ...
]
```

#### `PUT /api/users/:id/role`

Request:

```json
{ "role": "Editor" }
```

Response: updated user object (without password)

Behavior: changes role and revokes user's refresh tokens so new tokens reflect new role.

#### `DELETE /api/users/:id`

Response:

```json
{ "message": "User deactivated (soft deleted)" }
```

Behavior: sets `isDeleted: true`, revokes tokens.

#### `PUT /api/users/:id/restore`

Response:

```json
{ "message": "User restored", "user": { ... } }
```

Behavior: sets `isDeleted: false`. Restored user must re-login (refresh tokens were revoked at deletion).

---

### Content endpoints

* `GET /api/content` — authenticated users can list content (`isDeleted: false` filter)
* `POST /api/content` — Admin & Editor
* `PUT /api/content/:id` — Admin & Editor (Editor only for their own content)
* `DELETE /api/content/:id` — Admin or owner Editor (soft-delete sets `isDeleted: true`)

Examples follow standard patterns: JSON body `{ title, body }`. Content includes `author` populated.

---

## 6 — Security & behavior notes

* **Access tokens** are short-lived JWTs that contain at least `{ id, role, email }`. They are used in `Authorization: Bearer <token>`.
* **Refresh tokens** are stored in DB (`tokens` collection) with `tokenId` and `revoked` fields to enable rotation & revocation.
* **One-time tokens** (verify/reset) are random strings whose SHA-256 hashes are saved in DB and marked `used: true` after consumption.
* **Soft-deleted users**: `isDeleted: true` prevents login & protected route access. Admins can view and restore.
* **Profile updates** are stored in `profileUpdates` for audit.
* **Token invalidation**: on password change, soft-delete, etc., all refresh tokens for that user are revoked.
* **Validation & sanitation**: `express-validator` is used for request validation (email format, password strength) and some sanitization.
* **Email notifications**: on password change, account deactivation, email-change verification. If SMTP not configured, emails are logged to console.

---

## 7 — Admin bootstrap (create first admin)

Options:

1. **Seed script (recommended)** — `scripts/createAdmin.js` (run once, reads `ADMIN_EMAIL` & `ADMIN_PASSWORD` env vars). Example:

```bash
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='MyStrongPass123!' node scripts/createAdmin.js
```

2. **Manual DB insert** using `mongosh` or Compass — create a user document with `role: "Admin"` and a bcrypt-hashed password. Use `node -e "const b=require('bcryptjs');console.log(b.hashSync('MyPass',12))"` to create a hash.

After the first admin exists, that Admin may promote other users via `PUT /api/users/:id/role`.

---

## 8 — Testing

### Postman collection

**How to use**

1. Import the JSON into Postman (`Import → File`).
2. Set environment variables:

   * `base_url` → e.g. `http://localhost:4000`
   * `accessToken`, `refreshToken` (update after login)
   * `testUserEmail`, `testUserPassword`
   * `userId`, `contentId` as needed
3. Use `Login` to obtain tokens and copy them into environment variables.

---

### Useful `curl` examples

Register:

```bash
curl -X POST http://localhost:4000/api/auth/register \
 -H "Content-Type: application/json" \
 -d '{"name":"Alice","email":"alice@example.com","password":"StrongPass123!"}'
```

Login:

```bash
curl -X POST http://localhost:4000/api/auth/login \
 -H "Content-Type: application/json" \
 -d '{"email":"alice@example.com","password":"StrongPass123!"}'
# copy accessToken + refreshToken from response
```

Get profile:

```bash
curl -H "Authorization: Bearer <accessToken>" http://localhost:4000/api/profile
```

Change password:

```bash
curl -X PUT http://localhost:4000/api/profile/password \
 -H "Authorization: Bearer <accessToken>" \
 -H "Content-Type: application/json" \
 -d '{"currentPassword":"OldPass","newPassword":"NewStrongPass123!"}'
```

Soft-delete current user:

```bash
curl -X DELETE http://localhost:4000/api/profile \
 -H "Authorization: Bearer <accessToken>"
```

Admin list users including deleted:

```bash
curl -H "Authorization: Bearer <adminAccessToken>" "http://localhost:4000/api/users?includeDeleted=true"
```

Restore user (admin):

```bash
curl -X PUT http://localhost:4000/api/users/<userId>/restore \
 -H "Authorization: Bearer <adminAccessToken>"
```

---

## 9 — Production checklist

* Use HTTPS and proper TLS termination.
* Use a secure secret manager for `JWT_*` & SMTP credentials.
* Use a managed DB (MongoDB Atlas) with proper IP allowlist.
* Use rate limiting on auth endpoints to mitigate brute force.
* Add logging/monitoring & alerts for suspicious events (role changes, many failed logins).
* Enforce strong passwords and consider MFA (especially for Admins).
* Back up DB and test restore process.
* Remove or secure any bootstrap scripts or env vars used to create the initial Admin.