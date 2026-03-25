import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient.js';
import { Spinner } from '../components/UI/Spinner.jsx';
import lfiLogo from '../assets/lfi.png';

export default function ResetPasswordPage({ onDone }) {
  const [password,  setPassword]  = useState('');
  const [password2, setPassword2] = useState('');
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');
  const [done,      setDone]      = useState(false);
  const [ready,     setReady]     = useState(false);
  const [showPass,  setShowPass]  = useState(false);
  const [showPass2, setShowPass2] = useState(false);

  // Supabase puts the recovery token in the URL hash — exchange it for a session
  useEffect(() => {
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true);
    });
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres.'); return; }
    if (password !== password2) { setError('Las contraseñas no coinciden.'); return; }
    setLoading(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (err) { setError(err.message); return; }
    setDone(true);
    setTimeout(() => onDone?.(), 2500);
  }

  return (
    <div className="min-h-screen bg-[#0f1117] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src={lfiLogo} alt="LFi" className="w-16 h-16 rounded-2xl mx-auto mb-4 object-contain" />
          <h1 className="text-2xl font-bold text-[#e8eaf0] tracking-tight">Nueva contraseña</h1>
          <p className="text-sm text-[#555b70] mt-1">LFi Kanban Desk</p>
        </div>

        {done ? (
          <div className="bg-[#1a1d26] border border-[#2a2d3a] rounded-2xl p-6 text-center">
            <p className="text-green-400 text-sm">✅ Contraseña actualizada correctamente.</p>
            <p className="text-[#555b70] text-xs mt-2">Redirigiendo al login…</p>
          </div>
        ) : !ready ? (
          <div className="bg-[#1a1d26] border border-[#2a2d3a] rounded-2xl p-6 text-center">
            <Spinner size={6} />
            <p className="text-[#555b70] text-sm mt-3">Verificando enlace…</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-[#1a1d26] border border-[#2a2d3a] rounded-2xl p-6 space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#8b92a5] mb-1.5 uppercase tracking-wider">
                Nueva contraseña
              </label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoFocus
                  minLength={8}
                  placeholder="Mínimo 8 caracteres"
                  className="w-full bg-[#0f1117] border border-[#2a2d3a] rounded-lg px-3 py-2.5 pr-10
                             text-[#e8eaf0] text-sm placeholder-[#3a3f50]
                             focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-colors"
                />
                <button type="button" onClick={() => setShowPass(v => !v)} tabIndex={-1}
                  className="absolute inset-y-0 right-3 flex items-center text-[#555b70] hover:text-[#8b92a5] transition-colors">
                  {showPass
                    ? <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                    : <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  }
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#8b92a5] mb-1.5 uppercase tracking-wider">
                Confirmar contraseña
              </label>
              <div className="relative">
                <input
                  type={showPass2 ? 'text' : 'password'}
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                  required
                  placeholder="Repite la contraseña"
                  className="w-full bg-[#0f1117] border border-[#2a2d3a] rounded-lg px-3 py-2.5 pr-10
                             text-[#e8eaf0] text-sm placeholder-[#3a3f50]
                             focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-colors"
                />
                <button type="button" onClick={() => setShowPass2(v => !v)} tabIndex={-1}
                  className="absolute inset-y-0 right-3 flex items-center text-[#555b70] hover:text-[#8b92a5] transition-colors">
                  {showPass2
                    ? <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                    : <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  }
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
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50
                         text-white font-medium text-sm rounded-lg px-4 py-2.5
                         transition-colors flex items-center justify-center gap-2"
            >
              {loading ? <Spinner size={4} /> : 'Guardar contraseña'}
            </button>
          </form>
        )}

        <p className="text-center text-xs text-[#3a3f50] mt-6">
          LFi Kanban Desk · © 2026 Ibai Fernández
        </p>
      </div>
    </div>
  );
}
