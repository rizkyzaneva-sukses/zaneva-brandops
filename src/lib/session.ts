import { SessionOptions } from 'iron-session';

export interface SessionUser {
  id: string;
  email: string;
  full_name: string;
  role: string;
  brand_id: string | null;
  brand_name: string | null;
}

export interface SessionData {
  user?: SessionUser;
}

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET as string,
  cookieName: process.env.SESSION_COOKIE_NAME || 'zaneva_session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 7, // 7 days
  },
};
