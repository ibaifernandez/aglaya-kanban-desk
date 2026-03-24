import { useState } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Spinner } from '../components/UI/Spinner.jsx';
import lfiLogo from '../assets/lfi.png';
import { supabase } from '../utils/supabaseClient.js';

export default function LoginPage() {
  const { login } = useAuth();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [view,     setView]     = useState('login'); // 'login' | 'forgot' | 'forgot-sent'
  const [showPass, setShowPass] = useState(false);

  const ALLOWED_DOMAINS = ['lfi.la', 'lafabricaimaginaria.com'];

  function isAllowedEmail(addr) {
    const domain = addr.split('@')[1]?.toLowerCase();
    return ALLOWED_DOMAINS.includes(domain);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!isAllowedEmail(email)) {
      setError('Acceso restringido. Solo se permiten cuentas corporativas (@lfi.la, @lafabricaimaginaria.com).');
      return;
    }

    setLoading(true);
    try {
      const { token, user } = await api.login({ email, password });
      login(token, user);
    } catch (err) {
      setError(err.message || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0f1117] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        {/* Logo / título */}
        <div className="text-center mb-8">
          <img src={lfiLogo} alt="LFi" className="w-16 h-16 rounded-2xl mx-auto mb-4 object-contain" />
          <h1 className="text-2xl font-bold text-[#e8eaf0] tracking-tight">MyBoardLFi</h1>
          <p className="text-sm text-[#555b70] mt-1">Plataforma de gestión para LFi</p>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="bg-[#1a1d26] border border-[#2a2d3a] rounded-2xl p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#8b92a5] mb-1.5 uppercase tracking-wider">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              placeholder="tu@lfi.la"
              className="w-full bg-[#0f1117] border border-[#2a2d3a] rounded-lg px-3 py-2.5
                         text-[#e8eaf0] text-sm placeholder-[#3a3f50]
                         focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50
                         transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#8b92a5] mb-1.5 uppercase tracking-wider">
              Contraseña
            </label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full bg-[#0f1117] border border-[#2a2d3a] rounded-lg px-3 py-2.5 pr-10
                           text-[#e8eaf0] text-sm placeholder-[#3a3f50]
                           focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50
                           transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPass(v => !v)}
                className="absolute inset-y-0 right-3 flex items-center text-[#555b70] hover:text-[#8b92a5] transition-colors"
                tabIndex={-1}
              >
                {showPass ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed
                       text-white font-medium text-sm rounded-lg px-4 py-2.5
                       transition-colors flex items-center justify-center gap-2"
          >
            {loading ? <Spinner size={4} /> : 'Iniciar sesión'}
          </button>
        </form>

        {view === 'login' && (
          <button
            onClick={() => { setView('forgot'); setError(''); }}
            className="block text-center text-xs text-[#555b70] hover:text-indigo-400 mt-4 transition-colors w-full self-center"
          >
            ¿Olvidaste tu contraseña?
          </button>
        )}

        {view === 'forgot' && (
          <ForgotPassword
            initialEmail={email}
            onBack={() => { setView('login'); setError(''); }}
          />
        )}

        {view === 'forgot-sent' && (
          <p className="text-center text-sm text-green-400 mt-4">
            Revisa tu correo — te hemos enviado un enlace para restablecer tu contraseña.
          </p>
        )}

        <p className="text-center text-xs text-[#3a3f50] mt-6">
          MyBoardLFi · © 2026 Ibai Fernández
        </p>
      </div>
    </div>
  );
}

// ── Subcomponente: formulario de recuperación ─────────────────────────────────
function ForgotPassword({ initialEmail, onBack }) {
  const [email,   setEmail]   = useState(initialEmail || '');
  const [loading, setLoading] = useState(false);
  const [sent,    setSent]    = useState(false);
  const [error,   setError]   = useState('');

  const ALLOWED_DOMAINS = ['lfi.la', 'lafabricaimaginaria.com'];
  const isAllowed = (addr) => ALLOWED_DOMAINS.includes(addr.split('@')[1]?.toLowerCase());

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!isAllowed(email)) {
      setError('Solo se permiten cuentas corporativas (@lfi.la, @lafabricaimaginaria.com).');
      return;
    }
    setLoading(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (err) { setError(err.message); return; }
    setSent(true);
  }

  if (sent) return (
    <div className="bg-[#1a1d26] border border-[#2a2d3a] rounded-2xl p-6 text-center space-y-3 mt-[-1rem]">
      <p className="text-green-400 text-sm">✅ Revisa tu correo corporativo.</p>
      <p className="text-[#555b70] text-xs">
        Hemos enviado un enlace a <strong className="text-[#8b92a5]">{email}</strong>.
        Expira en 1 hora.
      </p>
      <button onClick={onBack} className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
        Volver al login
      </button>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="bg-[#1a1d26] border border-[#2a2d3a] rounded-2xl p-6 space-y-4 mt-[-1rem]">
      <p className="text-[#8b92a5] text-sm">
        Introduce tu email corporativo y te enviaremos un enlace para restablecer tu contraseña.
      </p>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        autoFocus
        placeholder="tu@lfi.la"
        className="w-full bg-[#0f1117] border border-[#2a2d3a] rounded-lg px-3 py-2.5
                   text-[#e8eaf0] text-sm placeholder-[#3a3f50]
                   focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-colors"
      />
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50
                   text-white font-medium text-sm rounded-lg px-4 py-2.5
                   transition-colors flex items-center justify-center gap-2"
      >
        {loading ? <Spinner size={4} /> : 'Enviar enlace'}
      </button>
      <button type="button" onClick={onBack} className="w-full text-xs text-[#555b70] hover:text-[#8b92a5] transition-colors">
        Volver al login
      </button>
    </form>
  );
}
