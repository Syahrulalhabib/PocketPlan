import { CheckIcon, CloseIcon } from './Icons.jsx';

const Toast = ({ toast }) => {
  if (!toast) return null;
  const isError = toast.type === 'error';

  return (
    <div className={`toast ${isError ? 'error' : 'success'}`} role="status" aria-live="polite">
      <span className="toast-icon">
        {isError ? <CloseIcon size={16} /> : <CheckIcon size={16} />}
      </span>
      <span className="toast-message">{toast.message}</span>
    </div>
  );
};

export default Toast;
