import { toast, type ExternalToast } from "sonner";

export const showSuccess = (message: string, options?: ExternalToast) => {
  toast.success(message, options);
};

export const showError = (message: string, options?: ExternalToast) => {
  toast.error(message, options);
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
