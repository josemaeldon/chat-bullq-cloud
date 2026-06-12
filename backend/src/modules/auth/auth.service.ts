import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import type { SignOptions } from 'jsonwebtoken';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { PasswordResetMailerService } from './password-reset-mailer.service';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly resetMailer: PasswordResetMailerService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const hashedPassword = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    // Check if registering via invitation
    if (dto.inviteToken) {
      return this.registerWithInvite(dto, hashedPassword);
    }

    return this.registerNewWorkspace(dto, hashedPassword);
  }

  private async registerNewWorkspace(dto: RegisterDto, hashedPassword: string) {
    const slug = this.generateSlug(dto.name);

    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: dto.name,
          email: dto.email,
          password: hashedPassword,
        },
      });

      const organization = await tx.organization.create({
        data: {
          name: `${dto.name}'s Workspace`,
          slug,
        },
      });

      await tx.userOrganization.create({
        data: {
          userId: user.id,
          organizationId: organization.id,
          role: 'OWNER',
        },
      });

      const defaultDepartment = await tx.department.create({
        data: {
          organizationId: organization.id,
          name: 'Geral',
          description: 'Departamento padrão',
          isDefault: true,
        },
      });

      const userOrg = await tx.userOrganization.findUnique({
        where: {
          userId_organizationId: {
            userId: user.id,
            organizationId: organization.id,
          },
        },
      });

      if (userOrg) {
        await tx.departmentAgent.create({
          data: {
            departmentId: defaultDepartment.id,
            userOrganizationId: userOrg.id,
          },
        });
      }

      return { user, organization };
    });

    const tokens = await this.generateTokens(
      result.user.id,
      result.user.email,
      result.user.tokenVersion,
    );
    this.logger.log(`User registered (new workspace): ${result.user.email}`);

    return {
      user: this.sanitizeUser(result.user),
      organizations: [
        this.mapOrganizationInfo({
          organization: result.organization,
          role: 'OWNER',
          channelAgents: [],
        }),
      ],
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  private async registerWithInvite(dto: RegisterDto, hashedPassword: string) {
    // Validate the invitation
    const invitation = await this.prisma.invitation.findUnique({
      where: { token: dto.inviteToken },
      include: { organization: true },
    });

    if (!invitation) {
      throw new BadRequestException('Invalid invitation token');
    }
    if (invitation.status !== 'PENDING') {
      throw new BadRequestException(`Invitation has already been ${invitation.status.toLowerCase()}`);
    }
    if (invitation.expiresAt < new Date()) {
      throw new BadRequestException('Invitation has expired');
    }
    if (invitation.email !== dto.email) {
      throw new BadRequestException('Email does not match the invitation');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: dto.name,
          email: dto.email,
          password: hashedPassword,
        },
      });

      // Add user to the invited organization
      const membership = await tx.userOrganization.create({
        data: {
          userId: user.id,
          organizationId: invitation.organizationId,
          role: invitation.role,
        },
      });

      // Add to default department
      const defaultDept = await tx.department.findFirst({
        where: { organizationId: invitation.organizationId, isDefault: true },
      });

      if (defaultDept) {
        await tx.departmentAgent.create({
          data: {
            departmentId: defaultDept.id,
            userOrganizationId: membership.id,
          },
        });
      }

      // Mark invitation as accepted
      await tx.invitation.update({
        where: { id: invitation.id },
        data: { status: 'ACCEPTED', acceptedAt: new Date() },
      });

      // Also accept any other pending invitations for this email
      await tx.invitation.updateMany({
        where: {
          email: dto.email,
          status: 'PENDING',
          id: { not: invitation.id },
        },
        data: { status: 'EXPIRED' },
      });

      return { user, organization: invitation.organization };
    });

    const tokens = await this.generateTokens(
      result.user.id,
      result.user.email,
      result.user.tokenVersion,
    );
    this.logger.log(`User registered via invitation: ${result.user.email} -> org ${result.organization.name}`);

    return {
      user: this.sanitizeUser(result.user),
      organizations: [
        this.mapOrganizationInfo({
          organization: result.organization,
          role: invitation.role,
          channelAgents: [],
        }),
      ],
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.password);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    const memberships = await this.prisma.userOrganization.findMany({
      where: { userId: user.id },
      include: {
        organization: true,
        channelAgents: { select: { channelId: true } },
      },
    });

    const tokens = await this.generateTokens(
      user.id,
      user.email,
      user.tokenVersion,
    );

    this.logger.log(`User logged in: ${user.email}`);

    return {
      user: this.sanitizeUser(user),
      organizations: memberships.map((m) => this.mapOrganizationInfo(m)),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  async refresh(refreshToken: string) {
    try {
      const payload = this.jwt.verify<{ sub: string; tv?: number }>(refreshToken, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (
        !user ||
        !user.isActive ||
        (payload.tv ?? 0) !== user.tokenVersion
      ) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      return this.generateTokens(user.id, user.email, user.tokenVersion);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) throw new UnauthorizedException();

    const memberships = await this.prisma.userOrganization.findMany({
      where: { userId },
      include: {
        organization: true,
        channelAgents: { select: { channelId: true } },
      },
    });

    return {
      user: this.sanitizeUser(user),
      organizations: memberships.map((m) => this.mapOrganizationInfo(m)),
    };
  }

  async requestPasswordReset(email: string) {
    const genericResponse = {
      message:
        'Se o e-mail estiver cadastrado, enviaremos as instruções de recuperação.',
    };
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: {
        email: { equals: normalizedEmail, mode: 'insensitive' },
        deletedAt: null,
      },
    });
    if (!user || !user.isActive) return genericResponse;

    const latest = await this.prisma.passwordResetToken.findFirst({
      where: { userId: user.id, usedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (
      latest &&
      latest.createdAt.getTime() > Date.now() - 60_000
    ) {
      return genericResponse;
    }

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = this.hashResetToken(rawToken);
    const resetRecord = await this.prisma.$transaction(async (tx) => {
      await tx.passwordResetToken.deleteMany({
        where: { userId: user.id, usedAt: null },
      });
      return tx.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      });
    });

    const publicUrl = (
      this.config.get<string>('APP_URL') || 'http://localhost:3000'
    ).replace(/\/+$/, '');
    const resetUrl = `${publicUrl}/reset-password?token=${rawToken}`;

    try {
      await this.resetMailer.sendResetEmail({
        email: user.email,
        name: user.name,
        resetUrl,
      });
    } catch (error: any) {
      await this.prisma.passwordResetToken
        .delete({ where: { id: resetRecord.id } })
        .catch(() => undefined);
      this.logger.error(
        `Password reset email failed for ${user.id}: ${error.message}`,
      );
    }

    return genericResponse;
  }

  async resetPassword(rawToken: string, password: string) {
    const tokenHash = this.hashResetToken(rawToken);
    const token = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });
    if (!token || token.usedAt || token.expiresAt <= new Date()) {
      throw new BadRequestException('Link inválido ou expirado');
    }

    const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.passwordResetToken.updateMany({
        where: {
          id: token.id,
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { usedAt: new Date() },
      });
      if (claimed.count !== 1) {
        throw new BadRequestException('Link inválido ou expirado');
      }
      await tx.user.update({
        where: { id: token.userId },
        data: {
          password: hashedPassword,
          tokenVersion: { increment: 1 },
        },
      });
      await tx.passwordResetToken.deleteMany({
        where: {
          userId: token.userId,
          id: { not: token.id },
        },
      });
    });
    return { message: 'Senha redefinida com sucesso' };
  }

  private hashResetToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private async generateTokens(
    userId: string,
    email: string,
    tokenVersion: number,
  ) {
    const payload = { sub: userId, email, tv: tokenVersion };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, {
        secret: this.config.get<string>('JWT_SECRET'),
        expiresIn: this.config.get<string>('JWT_EXPIRATION', '15m') as SignOptions['expiresIn'],
      }),
      this.jwt.signAsync(payload, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.config.get<string>('JWT_REFRESH_EXPIRATION', '7d') as SignOptions['expiresIn'],
      }),
    ]);

    return { accessToken, refreshToken };
  }

  private sanitizeUser(user: { password: string; [key: string]: unknown }) {
    const { password: _, ...rest } = user;
    return rest;
  }

  private mapOrganizationInfo(membership: {
    organization: { id: string; name: string; slug: string; settings?: unknown };
    role: string;
    channelAgents?: Array<{ channelId: string }>;
  }) {
    const settings =
      membership.organization.settings &&
      typeof membership.organization.settings === 'object' &&
      !Array.isArray(membership.organization.settings)
        ? (membership.organization.settings as Record<string, unknown>)
        : {};
    return {
      id: membership.organization.id,
      name: membership.organization.name,
      slug: membership.organization.slug,
      browserTabTitle:
        typeof settings.browserTabTitle === 'string'
          ? settings.browserTabTitle
          : null,
      role: membership.role,
      accessibleChannelIds:
        membership.role === 'OWNER' || membership.role === 'ADMIN'
          ? ('ALL' as const)
          : (membership.channelAgents ?? []).map((c) => c.channelId),
    };
  }

  private generateSlug(name: string): string {
    const base = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    return `${base}-${Date.now().toString(36)}`;
  }
}
