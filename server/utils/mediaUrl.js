/**
 * mediaUrl — rompe-caché para las URLs públicas de Supabase Storage.
 *
 * Por qué existe (bug 2026-07-22): avatares y portadas se guardan en una ruta
 * DETERMINISTA (`avatars/<userId><ext>`, `workspace-covers/<wsId><ext>`) con
 * `upsert: true`. La subida sobrescribe el fichero correctamente, pero
 * `getPublicUrl()` devuelve siempre la MISMA URL. El navegador y el CDN sirven
 * la copia cacheada: el usuario sube una imagen nueva, recibe 200, y sigue
 * viendo la vieja. Nada falla — y por eso nadie lo detecta.
 *
 * La ruta determinista es deseable (no acumula ficheros huérfanos por usuario).
 * Lo que hay que cambiar es la URL, no la ruta: un parámetro de versión basta
 * para que el navegador vuelva a pedirla.
 */

/**
 * Añade `?v=<timestamp>` a una URL pública.
 * @param {string} url    URL devuelta por getPublicUrl()
 * @param {number} [version=Date.now()]  Inyectable para poder testearlo.
 * @returns {string} la misma URL con el parámetro de versión
 */
function withCacheBuster(url, version = Date.now()) {
  if (!url) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}v=${version}`;
}

module.exports = { withCacheBuster };
