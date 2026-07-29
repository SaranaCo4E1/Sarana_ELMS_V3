# Employee Leave Management System

Laravel + Inertia + React + TypeScript implementation for employee leave operations.

## Features

- Role-based access for staff, managers, HR, and admins.
- Email login, password reset, and optional email 2FA.
- Staff leave request submission with attachments.
- Employee self-service profile module with emergency contact and work details.
- Manager/HR Team Center for roster, coverage, pending decisions, and upcoming leave.
- Working-day calculation excluding weekends and configured public holidays.
- Real-time balances for allowance, used, pending, adjustments, and available days.
- Manager approval and rejection with comments.
- Email notifications and in-app system alerts for submission and decisions.
- HR/admin management for departments, users, leave types, public holidays, and balance overrides.
- Self-service and QR attendance punching with branch, geolocation, and network verification.
- Effective-dated attendance schedules, manager review, manual corrections, and CSV export.
- Monthly leave attendance CSV export.
- FAQ-backed AI help module scaffold with chat logging.
- PostgreSQL-ready relational schema with audit logs.

## Local Setup

1. Install PHP 8.3+, Composer, Node 20.15+ and PostgreSQL.
2. Enable PHP PostgreSQL support (`pdo_pgsql` and `pgsql`) in `php.ini`.
3. Create the database:

```sql
CREATE DATABASE elms_leave;
```

4. Configure `.env`:

```env
DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=elms_leave
DB_USERNAME=postgres
DB_PASSWORD=your_password

# Comma-separated proxy addresses or CIDR ranges; leave empty when accessed directly.
TRUSTED_PROXIES=

# Demo history is generated for seeded accounts from this date through yesterday.
ATTENDANCE_SEED_BASELINE_DATE=2026-07-28

MAIL_MAILER=smtp
MAIL_HOST=your.smtp.host
MAIL_PORT=587
MAIL_USERNAME=your_username
MAIL_PASSWORD=your_password
MAIL_ENCRYPTION=tls
MAIL_FROM_ADDRESS=hr@elms.local
MAIL_FROM_NAME="Employee Leave Management System"
```

5. Run:

```bash
composer install
npm install
php artisan key:generate
php artisan storage:link
php artisan migrate --seed
npm run build
php artisan serve
```

Default seeded accounts all use password `testing123`:

- `ceo@niy.ai`
- `admin@niy.ai`
- `hr@niy.ai`
- `it@niy.ai`
- `sales@niy.ai`
- `hr.staff@niy.ai`
- `it.engineer@niy.ai`
- `it.support@niy.ai`
- `sreynimsamuser@gmail.com`
- `samuelsinat11@gmail.com`
- `hakkimhengg@gmail.com`
- `sean.sophearom77@gmail.com`
- `sales.rep@niy.ai`
- `sales.ops@niy.ai`

The seeder creates three active departments: `IT`, `Sales`, and `HR`. Seeded employee profiles use `Phnom Penh` as their work location. Leave types are seeded with annual leave `18` days, sick leave `5` days, and unpaid leave `30` days per year. It also creates sample leave requests, leave balances, system notifications, and deterministic attendance history for the listed demo accounts. Adjust `ATTENDANCE_SEED_BASELINE_DATE` to keep the desired demo-history window; the seeder does not rewrite or backfill unrelated users.

Public holidays are imported from JSON fixtures in `database/data/holidays/*.json`. Add or update a `{year}.json` file there before running `php artisan migrate --seed` or `php artisan db:seed`.

## Docker

Docker files live under `docker/` and are split by runtime flavor.

For local development with Laravel and Vite hot reload:

```bash
docker compose -f docker/compose.dev.yml up --build
```

The app is available at `http://localhost:8000` and Vite runs on `http://localhost:5173`. The dev flavor bind-mounts the project, installs Composer and npm dependencies into Docker volumes, and points Laravel at the bundled PostgreSQL service.

Run migrations and seed data after the containers are up:

```bash
docker compose -f docker/compose.dev.yml exec app php artisan migrate --seed
```

For a production-style build with compiled frontend assets, PHP-FPM, Nginx, a queue worker, and PostgreSQL:

```bash
docker compose -f docker/compose.prod.yml up --build -d
```

The production-style Nginx entrypoint is available at `http://localhost:8080`. Set production values in `.env` before deployment, especially `APP_KEY`, `APP_URL`, and a non-empty `DB_PASSWORD`. To run migrations on startup, set `RUN_MIGRATIONS=true`.

## Production Notes

Use a queue worker for reliable notifications:

```bash
php artisan queue:work --tries=3
```

Recommended Nginx server block:

```nginx
server {
    listen 443 ssl http2;
    server_name leave.elms.example;
    root /var/www/elms/public;

    index index.php;
    client_max_body_size 10M;

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location ~ \.php$ {
        include fastcgi_params;
        fastcgi_pass unix:/run/php/php8.3-fpm.sock;
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
        fastcgi_param DOCUMENT_ROOT $realpath_root;
    }
}
```

If a load balancer or reverse proxy terminates HTTPS, set `TRUSTED_PROXIES` to its addresses or CIDR ranges before caching configuration. On GCP VM, terminate HTTPS with a valid certificate, keep `.env` out of source control, run `php artisan config:cache`, and schedule Laravel maintenance tasks with:

```cron
* * * * * cd /var/www/elms && php artisan schedule:run >> /dev/null 2>&1
```

The scheduler runs attendance reconciliation every five minutes, materializing current workdays and finalizing records after their scheduled end time.
