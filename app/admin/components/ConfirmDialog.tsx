'use client';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onCancel} />
      <div className="relative bg-white rounded-xl shadow-lg max-w-md w-full mx-4 p-6">
        <h3 className="text-lg font-semibold text-dark-brown">{title}</h3>
        <p className="mt-2 text-sm text-taupe">{message}</p>
        <div className="mt-6 flex flex-col-reverse sm:flex-row justify-end gap-3">
          <button
            onClick={onCancel}
            className="w-full sm:w-auto px-4 py-3 sm:py-2 min-h-[44px] text-sm font-medium text-taupe bg-beige/50 hover:bg-beige rounded-lg transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`w-full sm:w-auto px-4 py-3 sm:py-2 min-h-[44px] text-sm font-medium text-white rounded-lg transition-colors ${
              destructive
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-gold hover:bg-gold-dark'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
