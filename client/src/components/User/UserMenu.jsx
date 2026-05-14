import { useEffect, useRef, useState } from 'react';
import { Camera, LogOut, UserCircle } from 'lucide-react';
import { api } from '../../api/client.js';
import { AvatarCropModal } from '../UI/AvatarCropModal.jsx';
import { DigestPreferences } from './DigestPreferences.jsx';

function ProfileDropdown({ user, onAvatarChange, onLogout, onClose, onPreferencesChange }) {
  const menuRef = useRef(null);
  const fileRef = useRef(null);
  const cropSrcRef = useRef(null);
  const [cropSrc, setCropSrc] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    function handleClick(event) {
      if (cropSrcRef.current) return;
      if (menuRef.current && !menuRef.current.contains(event.target)) onClose();
    }

    function handleEscape(event) {
      if (cropSrcRef.current) return;
      if (event.key === 'Escape') onClose();
    }

    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  function openCrop(src) {
    cropSrcRef.current = src;
    setCropSrc(src);
  }

  function closeCrop() {
    cropSrcRef.current = null;
    setCropSrc(null);
  }

  function handleFileSelect(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => openCrop(reader.result);
    reader.readAsDataURL(file);
    event.target.value = '';
  }

  async function handleCropConfirm(croppedFile) {
    setUploading(true);
    setError('');
    try {
      const url = await api.uploadAvatar(croppedFile);
      onAvatarChange?.(url);
      closeCrop();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <div
        ref={menuRef}
        className="absolute right-0 top-full mt-2 w-60 bg-[#1e2028] border border-[#2e3140] rounded-xl shadow-2xl z-50 overflow-hidden"
      >
        <div className="px-4 py-3 border-b border-[#2e3140]">
          <div className="flex items-center gap-3">
            <div
              className="relative group/av w-10 h-10 rounded-full overflow-hidden flex-shrink-0 cursor-pointer"
              onClick={() => fileRef.current?.click()}
              title="Cambiar foto de perfil"
            >
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-indigo-600 flex items-center justify-center text-white text-sm font-bold uppercase">
                  {user.name?.[0] ?? user.email?.[0] ?? '?'}
                </div>
              )}
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover/av:opacity-100 transition-opacity rounded-full">
                <Camera size={12} className="text-white" />
              </div>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-[#e8eaf0] truncate">{user.name ?? '—'}</p>
              <p className="text-[11px] text-[#555b70] truncate">{user.email}</p>
            </div>
          </div>
          {error && <p className="text-[10px] text-red-400 mt-2">{error}</p>}
        </div>

        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />

        <button
          onClick={() => fileRef.current?.click()}
          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-[#c8ccd8] hover:bg-[#252830] hover:text-[#e8eaf0] transition-colors"
        >
          <UserCircle size={13} className="text-[#555b70]" />
          Cambiar foto de perfil
        </button>

        <DigestPreferences user={user} onChange={onPreferencesChange} />

        <button
          onClick={() => { onClose(); onLogout(); }}
          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors border-t border-[#2e3140]"
        >
          <LogOut size={13} />
          Cerrar sesión
        </button>
      </div>

      {cropSrc && (
        <AvatarCropModal
          imageSrc={cropSrc}
          uploading={uploading}
          onConfirm={handleCropConfirm}
          onClose={closeCrop}
        />
      )}
    </>
  );
}

export function UserMenu({ user, onAvatarChange, onLogout, onPreferencesChange, className = '', showName = true }) {
  const [open, setOpen] = useState(false);

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-2 rounded-lg hover:bg-[#252830] px-2 py-1 transition-colors"
        title="Perfil"
      >
        <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0">
          {user?.avatarUrl ? (
            <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-indigo-600 flex items-center justify-center text-white text-xs font-semibold">
              {user?.name?.charAt(0)?.toUpperCase() ?? '?'}
            </div>
          )}
        </div>
        {showName && <span className="text-xs text-[#8b92a5] hidden sm:block">{user?.name}</span>}
      </button>

      {open && (
        <ProfileDropdown
          user={user}
          onAvatarChange={onAvatarChange}
          onLogout={onLogout}
          onPreferencesChange={onPreferencesChange}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
