import crypto from 'crypto';
import { promisify } from 'util';

// Convert crypto functions to async for better performance
const randomBytesAsync = promisify(crypto.randomBytes);

/**
 * Hashes a password using SHA-256 asynchronously
 * This improves performance by not blocking the main event loop
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = (await randomBytesAsync(16)).toString('hex');
  
  return new Promise<string>((resolve) => {
    const hash = crypto.createHmac('sha256', salt)
      .update(password)
      .digest('hex');
    resolve(`${salt}:${hash}`);
  });
}

/**
 * Verifies a password against a stored hash asynchronously
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const [salt, hash] = storedHash.split(':');
    const verifyHash = crypto.createHmac('sha256', salt)
      .update(password)
      .digest('hex');
    resolve(hash === verifyHash);
  });
}

/**
 * Creates typed session data for Express.session
 */
declare module 'express-session' {
  interface SessionData {
    userId: number;
    username: string;
    isAuthenticated: boolean;
    isAdmin: boolean;
  }
}

/**
 * Middleware to check if user is authenticated
 */
export function isAuthenticated(req: any, res: any, next: any) {
  if (req.session && req.session.isAuthenticated) {
    return next();
  }
  
  return res.status(401).json({
    success: false,
    message: 'Unauthorized - Please log in to access this resource'
  });
}

/**
 * Middleware to check if user is an admin
 */
export function isAdmin(req: any, res: any, next: any) {
  if (req.session && req.session.isAuthenticated && req.session.isAdmin) {
    return next();
  }
  
  return res.status(403).json({
    success: false,
    message: 'Forbidden - Admin privileges required'
  });
}