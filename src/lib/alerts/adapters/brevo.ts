import { sleep } from '../../ingestion/http';
import {
  EmailSendError,
  type EmailMessage,
  type EmailSender,
} from '../email-sender';

export interface BrevoOptions {
  apiKey: string;
  from: { email: string; name: string };
  fetch?: typeof fetch;
  sleep?: (milliseconds: number) => Promise<void>;
}
const ENDPOINT = 'https://api.brevo.com/v3/smtp/email';
const ATTEMPTS = 3;

/**
 * Brevo transactional API (https://developers.brevo.com/reference/sendtransacemail).
 * Brevo adds its own List-Unsubscribe header to transactional mail and documents no
 * way to override standard headers, so `unsubscribeUrl` is only used in the body.
 */
export function createBrevoSender(options: BrevoOptions): EmailSender {
  const fetcher = options.fetch ?? fetch;
  const pause = options.sleep ?? sleep;
  return {
    async send(message: EmailMessage) {
      const body = JSON.stringify({
        sender: options.from,
        to: [{ email: message.to }],
        subject: message.subject,
        htmlContent: message.html,
        textContent: message.text,
        tags: ['course-alerts'],
      });
      for (let attempt = 1; ; attempt++) {
        let response: Response;
        try {
          response = await fetcher(ENDPOINT, {
            method: 'POST',
            signal: AbortSignal.timeout(10000),
            headers: {
              'api-key': options.apiKey,
              'content-type': 'application/json',
              accept: 'application/json',
            },
            body,
          });
        } catch {
          if (attempt === ATTEMPTS)
            throw new EmailSendError('Brevo unreachable', true);
          await pause(1000 * 2 ** attempt);
          continue;
        }
        if (response.ok) {
          await response.body?.cancel();
          return;
        }
        // The error body may echo the recipient; only the status is reported.
        await response.body?.cancel();
        const retryable = response.status === 429 || response.status >= 500;
        if (!retryable || attempt === ATTEMPTS)
          throw new EmailSendError(`Brevo HTTP ${response.status}`, retryable);
        const retryAfter = Number(response.headers.get('retry-after'));
        await pause(
          Number.isFinite(retryAfter) && retryAfter > 0
            ? Math.min(retryAfter, 30) * 1000
            : 1000 * 2 ** attempt,
        );
      }
    },
  };
}
