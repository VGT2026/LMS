import { userIsActive } from './userActive';

export type AdminPublic = {
  id: number;
  name: string;
  email: string;
  role: 'admin';
  is_active: boolean;
  created_at?: string;
};

export function formatAdminPublic(user: {
  id?: number;
  name: string;
  email: string;
  role?: string;
  is_active?: boolean | number | string | null;
  created_at?: Date | string | null;
}): AdminPublic {
  return {
    id: Number(user.id),
    name: user.name,
    email: user.email,
    role: 'admin',
    is_active: userIsActive(user.is_active),
    ...(user.created_at != null && {
      created_at: new Date(user.created_at).toISOString(),
    }),
  };
}
