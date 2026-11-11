import { createBrevoSender } from './adapters/brevo';
import { createLogSender } from './adapters/log';
import type { EmailSender } from './email-sender';

export interface EmailConfig {
  EMAIL_PROVIDER?: string;
  EMAIL_FROM?: string;
  EMAIL_FROM_NAME?: string;
  BREVO_API_KEY?: string;
}

/**
 * The only place that knows which provider sends mail. Moving to Cloudflare Email
 * Service (Workers Paid) means adding adapters/cloudflare.ts and one case here.
 */
export function createEmailSender(config: EmailConfig): EmailSender {
  switch (config.EMAIL_PROVIDER) {
    case 'brevo':
      return createBrevoSender({
        apiKey: required(config.BREVO_API_KEY, 'BREVO_API_KEY'),
        from: {
          email: required(config.EMAIL_FROM, 'EMAIL_FROM'),
          name: config.EMAIL_FROM_NAME || 'UrbanLabs',
        },
      });
    case 'log':
      return createLogSender();
    default:
      throw new Error(`Unsupported EMAIL_PROVIDER: ${config.EMAIL_PROVIDER}`);
  }
}

function required(value: string | undefined, name: string): string {
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}
