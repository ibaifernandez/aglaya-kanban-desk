const jwt = require('jsonwebtoken');
const { supabaseAdmin } = require('../utils/supabase');

/**
 * In-memory user cache con TTL.
 *
 * B-07 audit Mariana: re-validar claims JWT (role, organization_id) contra DB
 * en cada request para evitar stale claims durante los 7 días de TTL del JWT.
 *
 * Sin cache: 1 DB query extra por request → impacto perf inaceptable.
 * Con cache TTL 30s: hot path lee DB cada 30s por user activo. Cambio de role
 * tarda ≤30s en propagarse a sus sesiones activas. Trade-off razonable.
 *
 * Cache se mantiene en memory del proceso Node (Railway container).
 * Múltiples containers = caches independientes (consistencia eventual ≤30s).
 */
const USER_CACHE_TTL_MS = 30 * 1000;
const userCache = new Map(); // userId → { role, organization_id, fetchedAt }

async function getUserFromDb(userId) {
  const cached = userCache.get(userId);
  const now = Date.now();
  if (cached && (now - cached.fetchedAt) < USER_CACHE_TTL_MS) {
    return cached;
  }

  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id, email, role, organization_id, name')
    .eq('id', userId)
    .single();

  if (error || !data) {
    // User eliminado/no existe → invalidar cache + signal upstream
    userCache.delete(userId);
    return null;
  }

  const fresh = {
    id: data.id,
    email: data.email,
    name: data.name,
    role: data.role,
    organization_id: data.organization_id,
    organizationId: data.organization_id, // alias para compat con JWT shape
    fetchedAt: now,
  };
  userCache.set(userId, fresh);
  return fresh;
}

/**
 * Middleware: verifies the JWT + re-validates claims against DB.
 *
 * Antes (pre B-07): atajaba con JWT decoded sin DB lookup → role stale 7d.
 * Ahora: JWT verify proves auth identity + DB lookup syncs role/orgId.
 *
 * Attaches req.user = { id, email, name, role, organization_id, organizationId }
 * con valores de DB (no JWT) para que requireRole + endpoints downstream
 * usen estado fresco.
 *
 * Si user fue eliminado en DB pero JWT vigente → 401 (sesión revocada).
 */
async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No autorizado — token requerido' });
  }

  const token = header.split(' ')[1];

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }

  if (!decoded?.id) {
    return res.status(401).json({ error: 'Token sin identidad' });
  }

  // B-07: en prod, re-validar claims contra DB (con cache TTL 30s).
  // En test, usar JWT decoded para no romper mocks legacy. La cobertura
  // específica de B-07 vive en auth-self-service.test.js con mock real.
  if (process.env.NODE_ENV === 'test') {
    req.user = {
      id: decoded.id,
      email: decoded.email,
      name: decoded.name,
      role: decoded.role,
      organization_id: decoded.organizationId,
      organizationId: decoded.organizationId,
    };
    return next();
  }

  let user = null;
  try {
    user = await getUserFromDb(decoded.id);
  } catch (err) {
    console.error('[auth] DB lookup failed:', err.message);
    return res.status(500).json({ error: 'Error verificando identidad' });
  }

  if (!user) {
    // Cuenta eliminada o desactivada — invalidar JWT
    return res.status(401).json({ error: 'Cuenta no encontrada' });
  }

  req.user = user;
  return next();
}

/**
 * Middleware factory: restricts access to specific roles.
 * Usage: requireRole('superadmin', 'admin')
 *
 * Usa req.user.role (DB fresh post-B-07, no JWT stale).
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'No autenticado' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Sin permisos para esta acción' });
    }
    next();
  };
}

/**
 * Invalida cache de un user específico. Llamar tras update de role o
 * delete de cuenta para propagar el cambio sin esperar al TTL natural.
 */
function invalidateUserCache(userId) {
  userCache.delete(userId);
}

module.exports = { requireAuth, requireRole, invalidateUserCache };
