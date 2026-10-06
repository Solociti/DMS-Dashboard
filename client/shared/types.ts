export interface AuthSession {
  authenticated: boolean;
  email?: string;
  mustChangePassword?: boolean;
}

export interface ManagedUser {
  id: number;
  email: string;
  createdAt: string;
}
