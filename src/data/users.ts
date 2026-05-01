import { User } from '../types';
import { hashPassword } from '../utils/auth';

// In-memory user store (replace with database later)
export const users: User[] = [];

// Predefined admin user
const createAdminUser = async (): Promise<User> => {
  const hashedPassword = await hashPassword('admin123');
  return {
    id: 1,
    name: 'System Administrator',
    email: 'admin@lmspro.com',
    password: hashedPassword,
    role: 'admin',
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
  };
};

// Initialize with admin user
export const initializeUsers = async (): Promise<void> => {
  const adminUser = await createAdminUser();
  users.push(adminUser);
  console.log('✅ Admin user initialized');
};

// User management functions
export const findUserByEmail = (email: string): User | undefined => {
  return users.find(user => user.email === email);
};

export const findUserById = (id: number): User | undefined => {
  return users.find(user => user.id === id);
};

export const createUser = async (userData: Omit<User, 'id' | 'created_at' | 'updated_at'>): Promise<User> => {
  const newUser: User = {
    ...userData,
    id: users.length + 1,
    created_at: new Date(),
    updated_at: new Date(),
  };

  // Hash password if provided
  if (newUser.password && !newUser.password.startsWith('$2a$')) {
    newUser.password = await hashPassword(newUser.password);
  }

  users.push(newUser);
  return newUser;
};

export const updateUser = (id: number, updates: Partial<User>): User | null => {
  const userIndex = users.findIndex(user => user.id === id);
  if (userIndex === -1) return null;

  users[userIndex] = {
    ...users[userIndex],
    ...updates,
    updated_at: new Date(),
  };

  return users[userIndex];
};

export const deleteUser = (id: number): boolean => {
  const userIndex = users.findIndex(user => user.id === id);
  if (userIndex === -1) return false;

  users.splice(userIndex, 1);
  return true;
};

// Get users by role
export const getUsersByRole = (role: string): User[] => {
  return users.filter(user => user.role === role);
};