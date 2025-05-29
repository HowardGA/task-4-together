import express from 'express';
import authRoutes from './routes/authRoute.js';
import cors from 'cors';
import session from 'express-session';
import sessionConfig from './middleware/sessionMiddleware.js';
import userRoute from './routes/userRoute.js';
import pg from 'pg';
import connectPgSimple from 'connect-pg-simple'; 
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const isProduction = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT || 3001;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const corsOptions = {
  origin:  'https://task-4-together.vercel.app',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], 
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'], 
};
app.use(cors(corsOptions));
app.use(express.json());

app.use(express.static(path.join(__dirname, '../client')));

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set.');
}
if (!sessionConfig.secret) {
    throw new Error('SESSION_SECRET is not set for express-session.');
}

const { Pool } = pg;
const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isProduction ? { rejectUnauthorized: false } : false, 
});

pgPool.on('error', (err, client) => {
  console.error('Unexpected error on idle PostgreSQL client', err);
});

const PgStore = connectPgSimple(session);
const sessionStore = new PgStore({
  pool: pgPool,
  tableName: 'user_sessions', 
  createTableIfMissing: true,
});
app.set('trust proxy', 1); 
app.use(session({
  store: sessionStore,                   
  name: sessionConfig.name,       
  secret: sessionConfig.secret,   
  resave: sessionConfig.resave,   
  saveUninitialized: sessionConfig.saveUninitialized, 
  cookie: {
    httpOnly: sessionConfig.cookie.httpOnly, 
    secure: sessionConfig.cookie.secure,    
    sameSite: sessionConfig.cookie.sameSite,  
    maxAge: sessionConfig.cookie.maxAge,      
  }
}));

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'API is running' });
});
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoute);


app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

export default app; 