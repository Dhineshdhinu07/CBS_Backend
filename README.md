# Consultation Booking System Backend

A secure Hono backend for a consultation booking system using Drizzle ORM with Cloudflare D1.

## Features

- JWT-based authentication
- Role-based access control (User/Admin)
- Secure booking management
- Payment integration with Cashfree
- Video conferencing with Zoho Meet
- Pagination, filtering, and search capabilities

## Tech Stack

- **Hono**: Backend framework
- **Drizzle ORM**: Database ORM
- **Cloudflare D1**: SQLite database
- **JWT (jose)**: Authentication
- **Zod**: Input validation
- **Cashfree**: Payment processing
- **Zoho Meet**: Video conferencing

## Setup

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd cbs_backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.dev.vars` file with the following environment variables:
   ```env
   JWT_SECRET=your_jwt_secret
   CASHFREE_APP_ID=your_cashfree_app_id
   CASHFREE_SECRET_KEY=your_cashfree_secret_key
   ZOHO_CLIENT_ID=your_zoho_client_id
   ZOHO_CLIENT_SECRET=your_zoho_client_secret
   FRONTEND_URL=http://localhost:3000
   ```

## Database Setup

1. Create a new D1 database:
   ```bash
   wrangler d1 create cbs-db
   ```

2. Update wrangler.toml with the database details:
   ```toml
   [[d1_databases]]
   binding = "DB"
   database_name = "cbs-db"
   database_id = "<your-database-id>"
   ```

3. Generate migration:
   ```bash
   npm run generate
   # or
   npx drizzle-kit generate:sqlite
   ```

4. Push migration to local D1:
   ```bash
   wrangler d1 migrations apply cbs-db --local
   ```

5. Push migration to production D1:
   ```bash
   wrangler d1 migrations apply cbs-db
   ```

## Development Commands

1. Start development server:
   ```bash
   npm run dev
   # or
   wrangler dev
   ```

2. Type checking:
   ```bash
   npm run typecheck
   # or
   tsc --noEmit
   ```

3. Build the project:
   ```bash
   npm run build
   ```

4. Deploy to Cloudflare Workers:
   ```bash
   npm run deploy
   # or
   wrangler deploy
   ```

## Wrangler Commands

### Database Operations
```bash
# Create a D1 database
wrangler d1 create <database-name>

# List all D1 databases
wrangler d1 list

# Execute SQL file
wrangler d1 execute <database-name> --local --file=./path/to/file.sql

# Execute SQL command
wrangler d1 execute <database-name> --local --command="SELECT * FROM users"

# Backup database
wrangler d1 backup <database-name>

# View migrations status
wrangler d1 migrations list <database-name>
```

### Development
```bash
# Start local development server
wrangler dev

# Start with local D1
wrangler dev --local --persist

# Start with specific port
wrangler dev --port 8787
```

### Deployment
```bash
# Deploy to production
wrangler deploy

# Deploy with specific environment
wrangler deploy --env production

# Tail production logs
wrangler tail

# List all deployments
wrangler deployments list
```

### Environment Variables
```bash
# List all secrets
wrangler secret list

# Add a secret
wrangler secret put SECRET_NAME

# Delete a secret
wrangler secret delete SECRET_NAME
```

## API Endpoints

### Authentication
- `POST /auth/login` - User login
- `GET /auth/me` - Get current user info

### User Routes
- `POST /bookings` - Create a booking
- `GET /bookings/my` - Get user's bookings
- `PATCH /bookings/:id` - Update a booking
- `DELETE /bookings/:id` - Delete a booking

### Admin Routes
- `GET /admin/bookings` - Get all bookings
- `PATCH /admin/bookings/:id` - Update any booking
- `DELETE /admin/bookings/:id` - Delete any booking

## Security Features

- JWT stored in httpOnly cookies
- CORS configuration
- Input validation with Zod
- Role-based access control
- Error handling middleware

## Troubleshooting

1. Reset local D1 database:
   ```bash
   rm -rf .wrangler/state/d1
   ```

2. Clear Wrangler cache:
   ```bash
   rm -rf .wrangler/state/cache
   ```

3. Check Workers logs:
   ```bash
   wrangler tail --format=pretty
   ```

## License

MIT
