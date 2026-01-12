import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import fs from 'fs/promises';
import path from 'path';
import { config } from '../config/index.js';
import { createChildLogger } from '../utils/logger.js';

const logger = createChildLogger('auth-service');

interface AdminUser {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  createdAt: string;
  lastLogin?: string;
}

interface AdminStore {
  users: AdminUser[];
  initialized: boolean;
}

interface JWTPayload {
  userId: string;
  email: string;
  iat?: number;
  exp?: number;
}

class AuthService {
  private storePath: string;
  private store: AdminStore = { users: [], initialized: false };
  private jwtSecret: string;

  constructor() {
    this.storePath = path.join(config.dataDir, 'admin.json');
    // Use API key as JWT secret (or generate a separate one)
    this.jwtSecret = config.apiKey || 'default-jwt-secret-change-me';
  }

  async initialize(): Promise<void> {
    await this.loadStore();
    
    // If no users exist, create default admin
    if (this.store.users.length === 0) {
      logger.info('No admin users found, creating default admin user');
      await this.createDefaultAdmin();
    }
    
    this.store.initialized = true;
    logger.info(`Auth service initialized with ${this.store.users.length} admin user(s)`);
  }

  private async loadStore(): Promise<void> {
    try {
      const data = await fs.readFile(this.storePath, 'utf-8');
      this.store = JSON.parse(data);
    } catch (error) {
      if ((error as { code?: string }).code === 'ENOENT') {
        logger.info('No admin store found, creating new one');
        this.store = { users: [], initialized: false };
        await this.saveStore();
      } else {
        throw error;
      }
    }
  }

  private async saveStore(): Promise<void> {
    await fs.writeFile(this.storePath, JSON.stringify(this.store, null, 2));
  }

  private async createDefaultAdmin(): Promise<void> {
    // Default credentials from config
    const defaultEmail = config.adminEmail || 'admin@localhost';
    const defaultPassword = config.adminPassword || 'admin123';
    
    const passwordHash = await bcrypt.hash(defaultPassword, 12);
    
    const adminUser: AdminUser = {
      id: 'admin-' + Date.now(),
      email: defaultEmail,
      passwordHash,
      name: 'Administrator',
      createdAt: new Date().toISOString(),
    };
    
    this.store.users.push(adminUser);
    await this.saveStore();
    
    logger.warn(`Default admin created with email: ${defaultEmail}`);
    logger.info('Admin credentials loaded from configuration');
  }

  async login(email: string, password: string): Promise<{ token: string; user: Omit<AdminUser, 'passwordHash'> } | null> {
    const user = this.store.users.find(u => u.email.toLowerCase() === email.toLowerCase());
    
    if (!user) {
      logger.warn(`Login attempt with unknown email: ${email}`);
      return null;
    }
    
    const isValid = await bcrypt.compare(password, user.passwordHash);
    
    if (!isValid) {
      logger.warn(`Invalid password for user: ${email}`);
      return null;
    }
    
    // Update last login
    user.lastLogin = new Date().toISOString();
    await this.saveStore();
    
    // Generate JWT token
    const payload: JWTPayload = {
      userId: user.id,
      email: user.email,
    };
    
    const signOptions: SignOptions = { expiresIn: '7d' };
    const token = jwt.sign(payload, this.jwtSecret, signOptions);
    
    logger.info(`User logged in: ${email}`);
    
    // Return token and user info (without password)
    const { passwordHash: _, ...userWithoutPassword } = user;
    return { token, user: userWithoutPassword };
  }

  verifyToken(token: string): JWTPayload | null {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as JWTPayload;
      return decoded;
    } catch (_error) {
      return null;
    }
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<boolean> {
    const user = this.store.users.find(u => u.id === userId);
    
    if (!user) {
      return false;
    }
    
    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    
    if (!isValid) {
      logger.warn(`Invalid current password for password change: ${user.email}`);
      return false;
    }
    
    user.passwordHash = await bcrypt.hash(newPassword, 12);
    await this.saveStore();
    
    logger.info(`Password changed for user: ${user.email}`);
    return true;
  }

  async updateUser(userId: string, updates: { name?: string; email?: string }): Promise<AdminUser | null> {
    const user = this.store.users.find(u => u.id === userId);
    
    if (!user) {
      return null;
    }
    
    if (updates.name) user.name = updates.name;
    if (updates.email) user.email = updates.email;
    
    await this.saveStore();
    
    const { passwordHash: _, ...userWithoutPassword } = user;
    return userWithoutPassword as AdminUser;
  }

  getUserById(userId: string): Omit<AdminUser, 'passwordHash'> | null {
    const user = this.store.users.find(u => u.id === userId);
    if (!user) return null;
    
    const { passwordHash: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }
}

export const authService = new AuthService();

