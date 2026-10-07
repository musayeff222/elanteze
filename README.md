# ALVER

Azərbaycan dilində elan platforması. Axtarış, filter, elan, favori, real-time yazışma, bildiriş, şikayət, rəy və admin moderasiyası bir yerdə işləyir.

Bu layihə Letgo brendinə, loqosuna və məzmununa aid deyil. Marketplace axını (axtarış → filter → elan → satıcı → mesaj → favori, və elan yerləşdirmə → moderasiya → satış) klassik elan saytlarının istifadəçi məntiqinə uyğundur, dizayn və ad isə ALVER-ə məxsusdur.

## Texnologiyalar

- Frontend: React, TypeScript, Tailwind CSS, Vite
- Backend: Node.js, TypeScript, Express
- Verilənlər bazası: PostgreSQL, Prisma
- Auth: JWT access token + refresh token, HTTP-only cookie, bcrypt
- Real-time: Socket.IO
- Validasiya: Zod
- Şəkillər: Sharp (WebP sıxılma və thumbnail)
- API sənədi: Swagger UI

## Quraşdırma

```bash
cd backend
npm install
cd ../frontend
npm install
```

`backend/.env.example` faylını `backend/.env` adı ilə kopyalayın. JWT sirlərini production-da ən azı 32 simvol edin.

## Verilənlər bazası

Docker varsa:

```bash
docker compose up -d postgres
```

Docker yoxdursa, backend qovluğunda daxili PostgreSQL:

```bash
cd backend
npm run db
```

Bu əmr `localhost:5432` ünvanında `alver` / `alver` istifadəçisi ilə bazanı açıq saxlayır.

Migrasiya və demo məlumat:

```bash
cd backend
npx prisma migrate dev
npm run seed
```

## Development

Üç proses:

```bash
cd backend && npm run db
cd backend && npm run dev
cd frontend && npm run dev
```

- Sayt: http://localhost:5173
- API: http://localhost:4000
- Swagger: http://localhost:4000/api/docs

Frontend `/api`, `/uploads` və `/socket.io` sorğularını backend-ə proxy edir. Cookie-lər eyni origin-də qalır.

## Demo giriş

| Rol | E-poçt | Şifrə |
| --- | --- | --- |
| Baş admin | admin@alver.az | Admin123! |
| Moderator | moderator@alver.az | Moderator123! |
| İstifadəçi | resad@alver.az | Istifadeci123! |
| İstifadəçi | leyla@alver.az | Istifadeci123! |
| İstifadəçi | elvin@alver.az | Istifadeci123! |

Yeni elanlar default olaraq moderasiyaya düşür (`autoApproveListings=false`). Admin paneldən təsdiqlənir. Demo elanların bir qismi artıq aktivdir.

Development mühitində e-poçt və şifrə bərpası linki cavabda və server jurnalında görünür. Production-da SMTP (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`) doldurulanda real məktub gedir.

## Test

PostgreSQL işləyəndə və migrasiya tətbiq olunanda:

```bash
cd backend
npm test
```

Testlər auth, elan, axtarış, favori, mesaj, şikayət, rəy və admin icazəsini yoxlayır.

## Production build

```bash
cd backend && npm run build
cd frontend && npm run build
```

Backend:

```bash
cd backend
npx prisma migrate deploy
npm start
```

## Docker

```bash
docker compose up --build
```

- Sayt: http://localhost:8080
- API: http://localhost:4000

`SEED_ON_START=true` olduqda backend ilk açılışda demo məlumatı yazır. Production sirlərini compose faylında dəyişin.

## Əsas API

| Metod | Ünvan | İzah |
| --- | --- | --- |
| POST | /api/auth/register | Qeydiyyat |
| POST | /api/auth/login | Giriş |
| POST | /api/auth/logout | Çıxış |
| POST | /api/auth/refresh | Sessiyanı yenilə |
| POST | /api/auth/forgot-password | Şifrə bərpası |
| POST | /api/auth/reset-password | Yeni şifrə |
| GET | /api/listings | Axtarış, filter, səhifələmə |
| GET | /api/listings/:id | Elan detalı |
| POST | /api/listings | Elan yarat |
| PATCH | /api/listings/:id | Elanı yenilə |
| DELETE | /api/listings/:id | Elanı sil |
| GET | /api/favorites | Favorilər |
| POST | /api/favorites/:listingId | Favoriyə əlavə |
| DELETE | /api/favorites/:listingId | Favoridən sil |
| GET | /api/messages | Mesajlar |
| POST | /api/messages | Mesaj göndər |
| GET | /api/notifications | Bildirişlər |
| PATCH | /api/notifications/:id/read | Oxundu |
| POST | /api/reports | Şikayət |
| POST | /api/reviews | Rəy |

Admin marşrutları `/api/admin` altındadır və `MODERATOR`, `ADMIN`, `SUPER_ADMIN` rolları ilə qorunur. İstifadəçi silmə və sayt tənzimləmələri yalnız `SUPER_ADMIN` üçündür.

Axtarış parametrləri: `q`, `category`, `subcategory`, `city`, `district`, `condition`, `brand`, `minPrice`, `maxPrice`, `date`, `sort`, `page`, `limit`.

Sort: `en-yeni`, `en-ucuz`, `en-bahali`, `en-cox-baxilan`.

## Rollar

- `USER` — elan, favori, mesaj, şikayət, rəy
- `MODERATOR` — elan moderasiyası və şikayətlər
- `ADMIN` — istifadəçilər, kateqoriyalar, rəylər
- `SUPER_ADMIN` — rol dəyişmə, istifadəçi silmə, sayt adı və SEO

## Mühit dəyişənləri

`backend/.env.example` faylına baxın: `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `CORS_ORIGIN`, `FRONTEND_URL`, `UPLOAD_DIR`, SMTP sahələri.
