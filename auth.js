import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export function signToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      full_name: user.full_name,
    },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );
}

export function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Provide a Bearer token.' });
  }
  const token = header.slice(7).trim();
  try {
    const payload = jwt.verify(token, env.jwtSecret);
    req.user = {
      id: Number(payload.sub),
      email: payload.email,
      role: payload.role,
      full_name: payload.full_name,
    };
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired authentication token.' });
  }
}

export function optionalAuth(req, _res, next) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    try {
      const payload = jwt.verify(header.slice(7).trim(), env.jwtSecret);
      req.user = {
        id: Number(payload.sub),
        email: payload.email,
        role: payload.role,
        full_name: payload.full_name,
      };
    } catch {
      // Proceed as anonymous user
    }
  }
  next();
}

export function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Forbidden: requires role [${allowedRoles.join(', ')}], current role is '${req.user.role}'.`,
      });
    }
    return next();
  };
}
