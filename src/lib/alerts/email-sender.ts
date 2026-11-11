/** Port for outgoing email. Adapters live in ./adapters; pick one with createEmailSender. */
export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** RFC 8058 one-click target, for adapters whose provider lets us set List-Unsubscribe. */
  unsubscribeUrl?: string;
}
export interface EmailSender {
  /** Resolves once the provider accepted the message; throws EmailSendError otherwise. */
  send(message: EmailMessage): Promise<void>;
}
export class EmailSendError extends Error {
  constructor(
    message: string,
    /** False when retrying the same message later cannot help (bad key, bad address). */
    readonly retryable: boolean,
  ) {
    super(message);
  }
}
