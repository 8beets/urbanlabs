import { describe, expect, it, vi } from 'vitest';
import {
  DIGEST_COURSE_LIMIT,
  InvalidAlertRequest,
  matchDigest,
  mayResendConfirmation,
  parseAlertRequest,
  signToken,
  verifyToken,
  type NewCourse,
} from '../../src/lib/alerts/subscription';
import {
  alertPath,
  confirmationEmail,
  describeTarget,
  digestEmail,
  searchUrl,
} from '../../src/lib/alerts/emails';
import { createBrevoSender } from '../../src/lib/alerts/adapters/brevo';
import { verifyTurnstile } from '../../src/lib/alerts/adapters/turnstile';
import { createEmailSender } from '../../src/lib/alerts/sender';
import { EmailSendError } from '../../src/lib/alerts/email-sender';

const SECRET = 'unit-test-secret-that-is-long-enough-000';
const form = (values: Record<string, string>) => new URLSearchParams(values);

describe('alert request validation', () => {
  it('normalizes a valid request', () => {
    expect(
      parseAlertRequest(
        form({
          email: ' Ana@Example.ORG ',
          category: 'cuina',
          city: 'barcelona',
        }),
        'ca',
      ),
    ).toEqual({
      email: 'ana@example.org',
      locale: 'ca',
      category: 'cuina',
      cityId: 'barcelona',
    });
    // A city without a category is a complete target.
    expect(
      parseAlertRequest(form({ email: 'a@b.cd', city: 'zaragoza' }), 'es'),
    ).toMatchObject({ category: null, cityId: 'zaragoza' });
  });

  it.each([
    [{ email: 'not-an-email', city: 'barcelona' }, 'email'],
    [{ email: 'a@b.c<script>', city: 'barcelona' }, 'email'],
    [{ email: `${'a'.repeat(250)}@b.cd`, city: 'barcelona' }, 'email'],
    // Every alert needs a city, with or without a category.
    [{ email: 'a@b.cd' }, 'city'],
    [{ email: 'a@b.cd', category: 'cuina' }, 'city'],
    [
      { email: 'a@b.cd', category: 'CU\u0000INA', city: 'barcelona' },
      'category',
    ],
    [{ email: 'a@b.cd', category: 'CUINA', city: 'barcelona' }, 'category'],
    [{ email: 'a@b.cd', city: 'Barcelona!' }, 'city'],
  ])('rejects %j', (values, reason) => {
    expect(() => parseAlertRequest(form(values), 'es')).toThrowError(
      new InvalidAlertRequest(reason),
    );
  });

  it('allows one confirmation email per pending subscription per day', () => {
    const now = new Date('2026-11-10T12:00:00Z');
    expect(
      mayResendConfirmation(
        { status: 'pending', confirmationSentAt: null },
        now,
      ),
    ).toBe(true);
    expect(
      mayResendConfirmation(
        { status: 'pending', confirmationSentAt: '2026-11-10T00:00:00.000Z' },
        now,
      ),
    ).toBe(false);
    expect(
      mayResendConfirmation(
        { status: 'pending', confirmationSentAt: '2026-11-09T11:59:00.000Z' },
        now,
      ),
    ).toBe(true);
    expect(
      mayResendConfirmation(
        { status: 'confirmed', confirmationSentAt: null },
        now,
      ),
    ).toBe(false);
  });
});

describe('signed alert links', () => {
  const id = '3f1c2b9e-1d2a-4c3b-9a8d-0123456789ab';

  it('round-trips and binds the token to its purpose and secret', async () => {
    const token = await signToken(SECRET, 'confirm', id);
    expect(await verifyToken(SECRET, 'confirm', token)).toBe(id);
    expect(await verifyToken(SECRET, 'unsubscribe', token)).toBeNull();
    expect(await verifyToken(`${SECRET}x`, 'confirm', token)).toBeNull();
  });

  it('rejects tampered and malformed tokens', async () => {
    const token = await signToken(SECRET, 'unsubscribe', id);
    const other = '3f1c2b9e-1d2a-4c3b-9a8d-0123456789ac';
    for (const value of [
      token.replace(id, other),
      `${token}x`,
      `${token}.extra`,
      'garbage',
      '',
      `${id}.`,
    ])
      expect(await verifyToken(SECRET, 'unsubscribe', value)).toBeNull();
  });

  it('refuses a short secret', async () => {
    await expect(signToken('short', 'confirm', id)).rejects.toThrow();
  });
});

function course(overrides: Partial<NewCourse>): NewCourse {
  return {
    id: 'e1',
    title: 'Anglès inicial',
    category: 'IDIOMES',
    cityId: 'barcelona',
    institution: 'Centre Cívic',
    startDate: '2099-01-10',
    scheduleText: null,
    officialUrl: 'https://example.org/course',
    firstSeenAt: '2026-11-08T10:00:00.000Z',
    ...overrides,
  };
}

describe('digest matching', () => {
  const target = {
    category: 'cuina',
    countryCode: 'ES',
    cityId: 'barcelona',
    lastDigestAt: '2026-11-01T00:00:00.000Z',
  };

  it('keeps only courses first seen after the last digest in the city and topic', () => {
    const courses = [
      course({ id: 'match', category: 'Gastronomia' }),
      course({
        id: 'old',
        category: 'CUINA',
        firstSeenAt: '2026-10-30T00:00:00.000Z',
      }),
      course({ id: 'other-city', category: 'CUINA', cityId: 'tarragona' }),
      course({ id: 'other-category', category: 'IDIOMES' }),
      course({ id: 'no-category', category: null }),
    ];
    expect(matchDigest(target, courses).map((row) => row.id)).toEqual([
      'match',
    ]);
    expect(
      matchDigest({ ...target, category: null }, courses).map((row) => row.id),
    ).toEqual(['match', 'other-category', 'no-category']);
  });

  it('caps the digest length', () => {
    const many = Array.from({ length: DIGEST_COURSE_LIMIT + 5 }, (_, index) =>
      course({ id: `e${index}`, category: 'CUINA' }),
    );
    expect(matchDigest(target, many)).toHaveLength(DIGEST_COURSE_LIMIT);
  });
});

describe('alert emails', () => {
  const cities = [{ id: 'alicante', name: 'Alicante' }];

  it('builds localized paths, descriptions and search links', () => {
    expect(alertPath('es')).toBe('/es/alertas');
    expect(alertPath('ca', 'confirm')).toBe('/ca/alertes/confirmar');
    expect(alertPath('ca', 'unsubscribe')).toBe('/ca/alertes/baixa');
    expect(alertPath('es', 'unsubscribe')).toBe('/es/alertas/baja');
    const target = { category: 'cuina', countryCode: 'ES', cityId: 'alicante' };
    expect(describeTarget(target, 'es', cities)).toBe(
      'Cocina y gastronomía en Alicante',
    );
    expect(describeTarget({ ...target, category: null }, 'ca', cities)).toBe(
      'cursos a Alacant',
    );
    expect(searchUrl('https://urbanlabs.example', target, 'ca')).toBe(
      'https://urbanlabs.example/ca/alicante/cursos?category=cuina',
    );
    expect(
      searchUrl(
        'https://urbanlabs.example',
        { ...target, category: null },
        'es',
      ),
    ).toBe('https://urbanlabs.example/es/alicante/cursos');
  });

  it('escapes untrusted course data and always includes the unsubscribe link', () => {
    const message = digestEmail({
      to: 'ana@example.org',
      locale: 'es',
      target: 'Cocina',
      courses: [course({ title: '<script>alert(1)</script> & "co"' })],
      searchUrl: 'https://urbanlabs.example/es/buscar?category=cuina',
      unsubscribeUrl: 'https://urbanlabs.example/es/alertas/baja?token=a.b',
    });
    expect(message.html).not.toContain('<script>');
    expect(message.html).toContain(
      '&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;co&quot;',
    );
    expect(message.html).toContain(
      'href="https://urbanlabs.example/es/alertas/baja?token=a.b"',
    );
    expect(message.text).toContain(
      'https://urbanlabs.example/es/alertas/baja?token=a.b',
    );
    expect(message.unsubscribeUrl).toBe(
      'https://urbanlabs.example/es/alertas/baja?token=a.b',
    );
    expect(message.subject).toBe('Cursos nuevos en UrbanLabs: Cocina');
    expect(message.text).toContain('Empieza: 10 ene 2099');
  });

  it('renders the confirmation email in the subscriber language', () => {
    const message = confirmationEmail({
      to: 'ana@example.org',
      locale: 'ca',
      target: 'Cuina',
      confirmUrl: 'https://urbanlabs.example/ca/alertes/confirmar?token=x',
    });
    expect(message.subject).toBe('Confirma el teu avís de cursos a UrbanLabs');
    expect(message.text).toContain(
      'https://urbanlabs.example/ca/alertes/confirmar?token=x',
    );
  });
});

describe('Brevo adapter', () => {
  const message = {
    to: 'ana@example.org',
    subject: 'Hola',
    html: '<p>Hola</p>',
    text: 'Hola',
  };
  const options = {
    apiKey: 'test-key',
    from: { email: 'avisos@urbanlabs.example', name: 'UrbanLabs' },
    sleep: async () => {},
  };

  it('posts the documented payload', async () => {
    const fetch = vi.fn(
      async () => new Response('{"messageId":"x"}', { status: 201 }),
    );
    await createBrevoSender({ ...options, fetch }).send(message);
    expect(fetch).toHaveBeenCalledOnce();
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.brevo.com/v3/smtp/email');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['api-key']).toBe(
      'test-key',
    );
    expect(JSON.parse(init.body as string)).toEqual({
      sender: options.from,
      to: [{ email: 'ana@example.org' }],
      subject: 'Hola',
      htmlContent: '<p>Hola</p>',
      textContent: 'Hola',
      tags: ['course-alerts'],
    });
  });

  it('retries 429 and network errors, then succeeds', async () => {
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('network'))
      .mockResolvedValueOnce(
        new Response('', { status: 429, headers: { 'retry-after': '2' } }),
      )
      .mockResolvedValueOnce(new Response('{}', { status: 201 }));
    const sleep = vi.fn(async () => {});
    await createBrevoSender({ ...options, fetch, sleep }).send(message);
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenLastCalledWith(2000);
  });

  it('fails without retrying a client error, reporting only the status', async () => {
    const fetch = vi.fn(
      async () =>
        new Response('{"message":"invalid email ana@example.org"}', {
          status: 400,
        }),
    );
    const error = await createBrevoSender({ ...options, fetch })
      .send(message)
      .catch((caught: unknown) => caught);
    expect(fetch).toHaveBeenCalledOnce();
    expect(error).toBeInstanceOf(EmailSendError);
    expect((error as EmailSendError).retryable).toBe(false);
    expect((error as Error).message).toBe('Brevo HTTP 400');
  });

  it('gives up after repeated server errors', async () => {
    const fetch = vi.fn(async () => new Response('', { status: 502 }));
    await expect(
      createBrevoSender({ ...options, fetch }).send(message),
    ).rejects.toMatchObject({ retryable: true });
    expect(fetch).toHaveBeenCalledTimes(3);
  });
});

describe('email sender selection', () => {
  it('requires explicit, complete provider configuration', () => {
    expect(() => createEmailSender({})).toThrow('Unsupported EMAIL_PROVIDER');
    expect(() =>
      createEmailSender({ EMAIL_PROVIDER: 'brevo', EMAIL_FROM: 'a@b.cd' }),
    ).toThrow('BREVO_API_KEY');
    expect(() =>
      createEmailSender({ EMAIL_PROVIDER: 'brevo', BREVO_API_KEY: 'k' }),
    ).toThrow('EMAIL_FROM');
    expect(createEmailSender({ EMAIL_PROVIDER: 'log' })).toHaveProperty('send');
  });
});

describe('Turnstile verification', () => {
  it('accepts only an explicit success from siteverify', async () => {
    const ok = vi.fn(async () => Response.json({ success: true }));
    expect(await verifyTurnstile('secret', 'token', '203.0.113.1', ok)).toBe(
      true,
    );
    const body = (ok.mock.calls[0] as unknown as [string, RequestInit])[1]
      .body as FormData;
    expect(body.get('remoteip')).toBe('203.0.113.1');
    expect(
      await verifyTurnstile('secret', 'token', null, async () =>
        Response.json({ success: false }),
      ),
    ).toBe(false);
    expect(
      await verifyTurnstile(
        'secret',
        'token',
        null,
        async () => new Response('oops', { status: 500 }),
      ),
    ).toBe(false);
    expect(
      await verifyTurnstile('secret', 'token', null, async () => {
        throw new TypeError('network');
      }),
    ).toBe(false);
  });

  it('does not call siteverify without a token', async () => {
    const fetch = vi.fn();
    expect(await verifyTurnstile('secret', '', null, fetch)).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });
});
