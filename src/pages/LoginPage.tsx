import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';

import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { useAuth } from '@/hooks/useAuth';
import type { LoginCredentials } from '@/types';
import { isValidEmail } from '@/utils/validators';

interface LocationState {
  from?: { pathname: string };
}

export function LoginPage() {
  const { isAuthenticated, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [authError, setAuthError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginCredentials>({
    defaultValues: { email: '', password: '', rememberMe: true },
  });

  // ProtectedRoute sends the page the user tried to open; go back there after login.
  const redirectTo =
    (location.state as LocationState | null)?.from?.pathname ?? '/dashboard';

  if (isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  const onSubmit = async (data: LoginCredentials) => {
    setAuthError(null);
    try {
      await login(data);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Login failed');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-gray-900">
      <div className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <h1 className="mb-1 text-xl font-bold text-gray-900 dark:text-gray-100">
          Admin Dashboard
        </h1>
        <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
          Sign in to manage products, orders and customers.
        </p>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col gap-4"
          noValidate
        >
          <Input
            type="email"
            label="Email"
            autoComplete="email"
            placeholder="admin@example.com"
            error={errors.email?.message}
            {...register('email', {
              required: 'Email is required',
              validate: (value) =>
                isValidEmail(value) || 'Enter a valid email address',
            })}
          />
          <Input
            type="password"
            label="Password"
            autoComplete="current-password"
            placeholder="••••••••"
            error={errors.password?.message}
            {...register('password', { required: 'Password is required' })}
          />

          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            <input
              type="checkbox"
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              {...register('rememberMe')}
            />
            Remember me
          </label>

          {authError && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {authError}
            </p>
          )}

          <Button type="submit" isLoading={isSubmitting} className="mt-2">
            Sign in
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-gray-400">
          Demo credentials: admin@example.com / admin123
        </p>
      </div>
    </div>
  );
}
