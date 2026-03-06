import { db } from '@/db/connection';
import { userLogins } from '@/db/schema';

interface LoginLogEntry {
  userId?: string | null;
  userType: 'user' | 'admin';
  email: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  success: boolean;
  failReason?: string | null;
  loginMethod?: string;
}

function lookupGeo(ip: string | null | undefined): { countryCode: string | null; city: string | null } {
  if (!ip || ip === 'unknown') return { countryCode: null, city: null };
  try {
    // geoip-lite needs data files; gracefully handle missing data
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const geoip = require('geoip-lite');
    const cleanIp = ip.replace(/^::ffff:/, '');
    const geo = geoip.lookup(cleanIp);
    if (!geo) return { countryCode: null, city: null };
    return {
      countryCode: geo.country || null,
      city: geo.city || null,
    };
  } catch {
    return { countryCode: null, city: null };
  }
}

export async function logLogin(entry: LoginLogEntry) {
  try {
    const { countryCode, city } = lookupGeo(entry.ipAddress);
    await db.insert(userLogins).values({
      userId: entry.userId ?? null,
      userType: entry.userType,
      email: entry.email,
      ipAddress: entry.ipAddress ?? null,
      userAgent: entry.userAgent ?? null,
      countryCode,
      city,
      success: entry.success,
      failReason: entry.failReason ?? null,
      loginMethod: entry.loginMethod ?? 'credentials',
    });
  } catch (error) {
    console.error('Failed to log login:', error);
  }
}
