import React from 'react';
import { AuthForm } from '../components/auth/AuthForm';
import type { AuthUser } from '../types';

interface AuthScreenProps {
  onLogin: (user: AuthUser) => void;
}

export function AuthScreen({ onLogin }: AuthScreenProps) {
  return <AuthForm onLogin={onLogin} />;
}
