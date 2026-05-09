import { toast, type ExternalToast } from "sonner";

export const showSuccess = (message: string, options?: ExternalToast) => {
  toast.success(message, options);
};

export const showError = (message: string, options?: ExternalToast) => {
  // Erros precisam ficar visíveis tempo suficiente pro usuário ler (padrão sonner = 4s, muito curto)
  toast.error(message, { duration: 8000, ...options });
};

export const showWarning = (message: string, options?: ExternalToast) => {
  toast.warning(message, options);
};

export const showInfo = (message: string, options?: ExternalToast) => {
  toast.info(message, options);
};

export const showLoading = (message: string) => {
  return toast.loading(message);
};

export const dismissToast = (toastId: string) => {
  toast.dismiss(toastId);
};
