import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

@Injectable()
export class PasswordResetMailerService {
  private readonly logger = new Logger(PasswordResetMailerService.name);
  private transporter?: Transporter;

  constructor(private readonly config: ConfigService) {}

  async sendResetEmail(input: {
    email: string;
    name: string;
    resetUrl: string;
  }): Promise<void> {
    const transporter = this.getTransporter();
    if (!transporter) {
      if (this.config.get<string>('NODE_ENV') !== 'production') {
        this.logger.warn(
          `SMTP not configured. Password reset URL for ${input.email}: ${input.resetUrl}`,
        );
        return;
      }
      throw new Error('SMTP is not configured');
    }

    const from =
      this.config.get<string>('SMTP_FROM') ||
      this.config.get<string>('SMTP_USER');
    await transporter.sendMail({
      from,
      to: input.email,
      subject: 'Redefinição de senha - Chat BullQ',
      text:
        `Olá, ${input.name}.\n\n` +
        `Use o link abaixo para redefinir sua senha. Ele expira em 1 hora:\n\n` +
        `${input.resetUrl}\n\n` +
        'Se você não solicitou a alteração, ignore este e-mail.',
      html: this.renderHtml(input.name, input.resetUrl),
    });
  }

  private getTransporter(): Transporter | undefined {
    if (this.transporter) return this.transporter;
    const host = this.config.get<string>('SMTP_HOST');
    const port = Number(this.config.get<string>('SMTP_PORT') || 587);
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASSWORD');
    if (!host || !user || !pass) return undefined;

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: this.config.get<string>('SMTP_SECURE') === 'true',
      auth: { user, pass },
    });
    return this.transporter;
  }

  private renderHtml(name: string, resetUrl: string): string {
    const safeName = this.escapeHtml(name);
    const safeUrl = this.escapeHtml(resetUrl);
    return `
      <div style="background:#f4f4f5;padding:32px;font-family:Arial,sans-serif;color:#18181b">
        <div style="max-width:560px;margin:auto;background:#fff;border-radius:16px;padding:32px">
          <h1 style="font-size:22px;margin:0 0 16px">Redefinir sua senha</h1>
          <p>Olá, ${safeName}.</p>
          <p>Recebemos uma solicitação para redefinir sua senha no Chat BullQ.</p>
          <p style="margin:28px 0">
            <a href="${safeUrl}" style="background:#18181b;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">
              Criar nova senha
            </a>
          </p>
          <p style="font-size:13px;color:#71717a">Este link expira em 1 hora e só pode ser usado uma vez.</p>
          <p style="font-size:13px;color:#71717a">Se você não solicitou a alteração, ignore este e-mail.</p>
        </div>
      </div>
    `;
  }

  private escapeHtml(value: string): string {
    return value.replace(
      /[&<>"']/g,
      (character) =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#039;',
        })[character]!,
    );
  }
}
