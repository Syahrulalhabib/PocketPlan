const Toast = ({ toast }) => {
  if (!toast) return null;
  return (
    <div className={`toast ${toast.type === 'error' ? 'error' : 'success'}`}>
      {toast.message}
    </div>
  );
};

export default Toast;
