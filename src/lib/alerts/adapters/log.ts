import type { EmailMessage, EmailSender } from '../email-sender';

/**
 * Local development and E2E only: prints the plain-text email so links can be followed.
 * Never configure it in production, where it would write addresses to logs.
 */
export function createLogSender(): EmailSender {
  return {
    async send(message: EmailMessage) {
      console.info(
        `[email] to=${message.to} subject=${message.subject}\n${message.text}`,
      );
    },
  };
}
