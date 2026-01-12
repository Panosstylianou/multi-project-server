import { Router, Request, Response } from 'express';
import { authService } from '../../services/auth-service.js';
import { createChildLogger } from '../../utils/logger.js';

const logger = createChildLogger('auth-routes');
const router = Router();

/**
 * POST /api/auth/login
 * Authenticate user and return JWT token
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({
        success: false,
        error: 'Email and password are required',
      });
      return;
    }

    const result = await authService.login(email, password);

    if (!result) {
      res.status(401).json({
        success: false,
        error: 'Invalid email or password',
      });
      return;
    }

    res.json({
      success: true,
      data: {
        token: result.token,
        user: result.user,
      },
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Login failed',
    });
  }
});

/**
 * POST /api/auth/verify
 * Verify a JWT token is valid
 */
router.post('/verify', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : req.body.token;

    if (!token) {
      res.status(401).json({
        success: false,
        error: 'No token provided',
      });
      return;
    }

    const payload = authService.verifyToken(token);

    if (!payload) {
      res.status(401).json({
        success: false,
        error: 'Invalid or expired token',
      });
      return;
    }

    const user = authService.getUserById(payload.userId);

    res.json({
      success: true,
      data: {
        valid: true,
      user,
    },
  });
  } catch {
    res.status(401).json({
      success: false,
      error: 'Token verification failed',
    });
  }
});

/**
 * POST /api/auth/logout
 * Logout (client-side token removal, but we log it)
 */
router.post('/logout', async (req: Request, res: Response) => {
  // JWT tokens are stateless, so logout is handled client-side
  // We just acknowledge the request
  logger.info('User logged out');
  res.json({
    success: true,
    message: 'Logged out successfully',
  });
});

/**
 * POST /api/auth/change-password
 * Change the current user's password
 */
router.post('/change-password', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
      return;
    }

    const payload = authService.verifyToken(token);

    if (!payload) {
      res.status(401).json({
        success: false,
        error: 'Invalid or expired token',
      });
      return;
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      res.status(400).json({
        success: false,
        error: 'Current password and new password are required',
      });
      return;
    }

    if (newPassword.length < 8) {
      res.status(400).json({
        success: false,
        error: 'New password must be at least 8 characters',
      });
      return;
    }

    const success = await authService.changePassword(payload.userId, currentPassword, newPassword);

    if (!success) {
      res.status(400).json({
        success: false,
        error: 'Current password is incorrect',
      });
      return;
    }

    res.json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch {
    res.status(500).json({
      success: false,
      error: 'Password change failed',
    });
  }
});

export default router;

