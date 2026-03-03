import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Hoisted mocks ──────────────────────────────────────────────────────────

const mockSendMail = vi.hoisted(() => vi.fn().mockResolvedValue({ messageId: 'msg-1' }));
const mockCreateTransport = vi.hoisted(() =>
  vi.fn().mockReturnValue({ sendMail: mockSendMail }),
);

vi.mock('nodemailer', () => ({
  default: {
    createTransport: mockCreateTransport,
  },
}));

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('email', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    delete process.env.EMAIL_FROM;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  // ── SMTP not configured ───────────────────────────────────────────────────

  describe('when SMTP is not configured', () => {
    it('returns false when SMTP_HOST is missing', async () => {
      process.env.SMTP_USER = 'user';
      process.env.SMTP_PASS = 'pass';
      const { sendEmail } = await import('@/lib/email');

      const result = await sendEmail('test@example.com', 'Subject', '<p>Body</p>');

      expect(result).toBe(false);
      expect(mockSendMail).not.toHaveBeenCalled();
    });

    it('returns false when SMTP_USER is missing', async () => {
      process.env.SMTP_HOST = 'smtp.example.com';
      process.env.SMTP_PASS = 'pass';
      const { sendEmail } = await import('@/lib/email');

      const result = await sendEmail('test@example.com', 'Subject', '<p>Body</p>');

      expect(result).toBe(false);
    });

    it('returns false when SMTP_PASS is missing', async () => {
      process.env.SMTP_HOST = 'smtp.example.com';
      process.env.SMTP_USER = 'user';
      const { sendEmail } = await import('@/lib/email');

      const result = await sendEmail('test@example.com', 'Subject', '<p>Body</p>');

      expect(result).toBe(false);
    });

    it('returns false when all SMTP vars are missing', async () => {
      const { sendEmail } = await import('@/lib/email');

      const result = await sendEmail('test@example.com', 'Subject', '<p>Body</p>');

      expect(result).toBe(false);
    });

    it('logs a skip message when SMTP not configured', async () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const { sendEmail } = await import('@/lib/email');

      await sendEmail('test@example.com', 'Hello', '<p>World</p>');

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('SMTP not configured'),
      );
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('test@example.com'),
      );
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('"Hello"'),
      );

      logSpy.mockRestore();
    });

    it('does not create a transport when SMTP not configured', async () => {
      const { sendEmail } = await import('@/lib/email');

      await sendEmail('test@example.com', 'Subject', '<p>Body</p>');

      expect(mockCreateTransport).not.toHaveBeenCalled();
    });
  });

  // ── SMTP configured — successful send ──────────────────────────────────────

  describe('when SMTP is configured', () => {
    beforeEach(() => {
      process.env.SMTP_HOST = 'smtp.example.com';
      process.env.SMTP_USER = 'user@example.com';
      process.env.SMTP_PASS = 'secret';
    });

    it('creates transport with correct host, port defaults to 587', async () => {
      const { sendEmail } = await import('@/lib/email');

      await sendEmail('to@example.com', 'Subject', '<p>Body</p>');

      expect(mockCreateTransport).toHaveBeenCalledWith({
        host: 'smtp.example.com',
        port: 587,
        secure: false,
        auth: {
          user: 'user@example.com',
          pass: 'secret',
        },
      });
    });

    it('uses custom SMTP_PORT when set', async () => {
      process.env.SMTP_PORT = '2525';
      const { sendEmail } = await import('@/lib/email');

      await sendEmail('to@example.com', 'Subject', '<p>Body</p>');

      expect(mockCreateTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          port: 2525,
          secure: false,
        }),
      );
    });

    it('sets secure=true when SMTP_PORT is 465', async () => {
      process.env.SMTP_PORT = '465';
      const { sendEmail } = await import('@/lib/email');

      await sendEmail('to@example.com', 'Subject', '<p>Body</p>');

      expect(mockCreateTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          port: 465,
          secure: true,
        }),
      );
    });

    it('sets secure=false when SMTP_PORT is not 465', async () => {
      process.env.SMTP_PORT = '587';
      const { sendEmail } = await import('@/lib/email');

      await sendEmail('to@example.com', 'Subject', '<p>Body</p>');

      expect(mockCreateTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          secure: false,
        }),
      );
    });

    it('returns true on successful send', async () => {
      const { sendEmail } = await import('@/lib/email');

      const result = await sendEmail('to@example.com', 'Test Subject', '<h1>Hi</h1>');

      expect(result).toBe(true);
    });

    it('calls sendMail with correct parameters', async () => {
      const { sendEmail } = await import('@/lib/email');

      await sendEmail('recipient@test.com', 'Important', '<p>Content</p>');

      expect(mockSendMail).toHaveBeenCalledWith({
        from: 'noreply@omenaa.pl',
        to: 'recipient@test.com',
        subject: 'Important',
        html: '<p>Content</p>',
      });
    });

    it('uses EMAIL_FROM env when set', async () => {
      process.env.EMAIL_FROM = 'custom@sender.com';
      const { sendEmail } = await import('@/lib/email');

      await sendEmail('to@example.com', 'Subject', '<p>Body</p>');

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'custom@sender.com',
        }),
      );
    });

    it('uses default noreply@omenaa.pl when EMAIL_FROM is not set', async () => {
      delete process.env.EMAIL_FROM;
      const { sendEmail } = await import('@/lib/email');

      await sendEmail('to@example.com', 'Subject', '<p>Body</p>');

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'noreply@omenaa.pl',
        }),
      );
    });

    it('caches the transporter on subsequent calls', async () => {
      const { sendEmail } = await import('@/lib/email');

      await sendEmail('a@b.com', 'First', '<p>1</p>');
      await sendEmail('c@d.com', 'Second', '<p>2</p>');

      // Transport created only once
      expect(mockCreateTransport).toHaveBeenCalledTimes(1);
      // But sendMail called twice
      expect(mockSendMail).toHaveBeenCalledTimes(2);
    });
  });

  // ── Error handling ────────────────────────────────────────────────────────

  describe('error handling', () => {
    beforeEach(() => {
      process.env.SMTP_HOST = 'smtp.example.com';
      process.env.SMTP_USER = 'user@example.com';
      process.env.SMTP_PASS = 'secret';
    });

    it('returns false when sendMail throws', async () => {
      mockSendMail.mockRejectedValueOnce(new Error('SMTP connection failed'));
      const { sendEmail } = await import('@/lib/email');

      const result = await sendEmail('to@example.com', 'Subject', '<p>Body</p>');

      expect(result).toBe(false);
    });

    it('logs the error when sendMail throws', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const sendError = new Error('SMTP timeout');
      mockSendMail.mockRejectedValueOnce(sendError);
      const { sendEmail } = await import('@/lib/email');

      await sendEmail('fail@example.com', 'Fail Subject', '<p>Error</p>');

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to send to fail@example.com'),
        sendError,
      );

      errorSpy.mockRestore();
    });

    it('does not throw even on send failure', async () => {
      mockSendMail.mockRejectedValueOnce(new Error('Network error'));
      const { sendEmail } = await import('@/lib/email');

      await expect(
        sendEmail('to@example.com', 'Subject', '<p>Body</p>'),
      ).resolves.toBe(false);
    });

    it('handles non-Error exceptions in sendMail', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockSendMail.mockRejectedValueOnce('string error');
      const { sendEmail } = await import('@/lib/email');

      const result = await sendEmail('to@example.com', 'Subject', '<p>Body</p>');

      expect(result).toBe(false);
      errorSpy.mockRestore();
    });
  });

  // ── Edge cases ─────────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('handles empty string recipient', async () => {
      process.env.SMTP_HOST = 'smtp.example.com';
      process.env.SMTP_USER = 'user';
      process.env.SMTP_PASS = 'pass';
      const { sendEmail } = await import('@/lib/email');

      await sendEmail('', 'Subject', '<p>Body</p>');

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({ to: '' }),
      );
    });

    it('handles empty HTML body', async () => {
      process.env.SMTP_HOST = 'smtp.example.com';
      process.env.SMTP_USER = 'user';
      process.env.SMTP_PASS = 'pass';
      const { sendEmail } = await import('@/lib/email');

      const result = await sendEmail('to@example.com', 'Subject', '');

      expect(result).toBe(true);
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({ html: '' }),
      );
    });

    it('handles complex HTML content', async () => {
      process.env.SMTP_HOST = 'smtp.example.com';
      process.env.SMTP_USER = 'user';
      process.env.SMTP_PASS = 'pass';
      const { sendEmail } = await import('@/lib/email');

      const html = '<html><body><h1>Title</h1><p>Content with <a href="https://example.com">link</a></p></body></html>';
      const result = await sendEmail('to@example.com', 'Subject', html);

      expect(result).toBe(true);
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({ html }),
      );
    });
  });
});
