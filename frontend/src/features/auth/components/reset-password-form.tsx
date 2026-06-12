'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm, type UseFormRegisterReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, KeyRound, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { authService } from '../services/auth.service';
import {
  resetPasswordSchema,
  type ResetPasswordFormData,
} from '../schemas/password-recovery.schema';

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState(false);
  const form = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const onSubmit = async (data: ResetPasswordFormData) => {
    if (!token) return;
    setLoading(true);
    try {
      await authService.resetPassword(token, data.password);
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      setCompleted(true);
      toast.success('Senha redefinida com sucesso');
      setTimeout(() => router.push('/login'), 1500);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Não foi possível redefinir a senha',
      );
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <RecoveryState
        title="Link inválido"
        description="O endereço de recuperação está incompleto. Solicite um novo link."
      />
    );
  }

  if (completed) {
    return (
      <RecoveryState
        success
        title="Senha alterada"
        description="Sua nova senha já está ativa. Redirecionando para o login..."
      />
    );
  }

  return (
    <div className="mx-auto w-full max-w-sm space-y-8">
      <div className="space-y-2 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
          <KeyRound className="h-6 w-6 text-primary-foreground" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Criar nova senha</h1>
        <p className="text-sm text-muted-foreground">
          Use pelo menos 8 caracteres. O link só pode ser utilizado uma vez.
        </p>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <PasswordField
          id="password"
          label="Nova senha"
          error={form.formState.errors.password?.message}
          registration={form.register('password')}
        />
        <PasswordField
          id="confirmPassword"
          label="Confirmar nova senha"
          error={form.formState.errors.confirmPassword?.message}
          registration={form.register('confirmPassword')}
        />
        <button
          type="submit"
          disabled={loading}
          className="inline-flex h-10 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Redefinir senha
        </button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        <Link href="/login" className="font-medium text-primary hover:underline">
          Voltar para o login
        </Link>
      </p>
    </div>
  );
}

function PasswordField({
  id,
  label,
  error,
  registration,
}: {
  id: string;
  label: string;
  error?: string;
  registration: UseFormRegisterReturn;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        type="password"
        autoComplete="new-password"
        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        placeholder="Mínimo 8 caracteres"
        {...registration}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function RecoveryState({
  title,
  description,
  success = false,
}: {
  title: string;
  description: string;
  success?: boolean;
}) {
  return (
    <div className="mx-auto w-full max-w-sm space-y-6 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
        {success ? (
          <CheckCircle2 className="h-6 w-6 text-primary-foreground" />
        ) : (
          <KeyRound className="h-6 w-6 text-primary-foreground" />
        )}
      </div>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      </div>
      {!success && (
        <Link href="/forgot-password" className="font-medium text-primary hover:underline">
          Solicitar novo link
        </Link>
      )}
    </div>
  );
}
