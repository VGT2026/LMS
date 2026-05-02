import dotenv from 'dotenv';

dotenv.config();

/** API origin (no trailing slash). Set API_BASE_URL for staging/production. */
export const API_ORIGIN = (process.env.API_BASE_URL || 'http://localhost:3001').replace(
  /\/$/,
  ''
);
