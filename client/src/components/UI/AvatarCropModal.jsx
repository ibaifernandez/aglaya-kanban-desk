import { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { Spinner } from './Spinner.jsx';

// Convert crop area to a Blob using canvas
async function getCroppedBlob(imageSrc, pixelCrop) {
  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener('load', () => resolve(img));
    img.addEventListener('error', reject);
    img.src = imageSrc;
  });

  const canvas = document.createElement('canvas');
  canvas.width  = pixelCrop.width;
  canvas.height = pixelCrop.height;
  const ctx = canvas.getContext('2d');

  ctx.drawImage(
    image,
    pixelCrop.x, pixelCrop.y,
    pixelCrop.width, pixelCrop.height,
    0, 0,
    pixelCrop.width, pixelCrop.height
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Canvas vacío'));
    }, 'image/jpeg', 0.9);
  });
}

export function AvatarCropModal({ imageSrc, onConfirm, onClose, uploading }) {
  const [crop,       setCrop]       = useState({ x: 0, y: 0 });
  const [zoom,       setZoom]       = useState(1);
  const [croppedArea, setCroppedArea] = useState(null);

  const onCropComplete = useCallback((_, croppedAreaPixels) => {
    setCroppedArea(croppedAreaPixels);
  }, []);

  async function handleConfirm() {
    if (!croppedArea) return;
    const blob = await getCroppedBlob(imageSrc, croppedArea);
    const file = new File([blob], 'avatar.jpg', { type: 'image/jpeg' });
    onConfirm(file);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#1a1d26] border border-[#2a2d3a] rounded-xl w-full max-w-sm shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#2a2d3a]">
          <h2 className="text-sm font-semibold text-[#e8eaf0]">Recortar foto de perfil</h2>
          <p className="text-xs text-[#555b70] mt-0.5">Arrastra y usa la rueda del ratón para ajustar</p>
        </div>

        {/* Crop area */}
        <div className="relative w-full" style={{ height: 280, background: '#0f1117' }}>
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>

        {/* Zoom slider */}
        <div className="px-5 py-3 border-t border-[#2a2d3a]">
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-full accent-indigo-500"
          />
        </div>

        <div className="flex justify-end gap-2 px-5 pb-4">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-[#8b92a5] hover:text-[#e8eaf0] transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={uploading}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {uploading ? <Spinner size={3} /> : null}
            {uploading ? 'Subiendo…' : 'Guardar foto'}
          </button>
        </div>
      </div>
    </div>
  );
}
