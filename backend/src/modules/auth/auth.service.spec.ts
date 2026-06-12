import { BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';

describe('AuthService password recovery', () => {
  const jwt = { signAsync: jest.fn(), verify: jest.fn() };
  const config = {
    get: jest.fn((key: string) =>
      key === 'APP_URL' ? 'https://app.example.com' : undefined,
    ),
  };
  const mailer = { sendResetEmail: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the same response when the email does not exist', async () => {
    const prisma = {
      user: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const service = new AuthService(
      prisma as any,
      jwt as any,
      config as any,
      mailer as any,
    );

    await expect(
      service.requestPasswordReset('unknown@example.com'),
    ).resolves.toEqual({
      message:
        'Se o e-mail estiver cadastrado, enviaremos as instruções de recuperação.',
    });
    expect(mailer.sendResetEmail).not.toHaveBeenCalled();
  });

  it('rejects an expired reset token', async () => {
    const prisma = {
      passwordResetToken: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'token-id',
          userId: 'user-id',
          usedAt: null,
          expiresAt: new Date(Date.now() - 1000),
        }),
      },
    };
    const service = new AuthService(
      prisma as any,
      jwt as any,
      config as any,
      mailer as any,
    );

    await expect(
      service.resetPassword('a'.repeat(64), 'new-password'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('changes the password and increments the session token version', async () => {
    const tx = {
      passwordResetToken: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      user: { update: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      passwordResetToken: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'token-id',
          userId: 'user-id',
          usedAt: null,
          expiresAt: new Date(Date.now() + 60_000),
        }),
      },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    const service = new AuthService(
      prisma as any,
      jwt as any,
      config as any,
      mailer as any,
    );

    await expect(
      service.resetPassword('b'.repeat(64), 'new-password'),
    ).resolves.toEqual({ message: 'Senha redefinida com sucesso' });
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'user-id' },
      data: {
        password: expect.any(String),
        tokenVersion: { increment: 1 },
      },
    });
  });
});
