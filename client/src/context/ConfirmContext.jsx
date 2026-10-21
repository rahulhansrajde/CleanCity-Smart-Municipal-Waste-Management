import { createContext, useCallback, useContext, useRef, useState } from 'react';
import Modal from '../components/Modal';

const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [opts, setOpts] = useState(null);
  const resolver = useRef(null);

  const confirm = useCallback(
    (o) =>
      new Promise((resolve) => {
        resolver.current = resolve;
        setOpts(o);
      }),
    []
  );

  const close = (result) => {
    resolver.current?.(result);
    resolver.current = null;
    setOpts(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        open={!!opts}
        size="sm"
        title={opts?.title || 'Are you sure?'}
        onClose={() => close(false)}
        footer={
          <>
            <button className="btn" onClick={() => close(false)}>
              Cancel
            </button>
            <button className={opts?.danger === false ? 'btn btn-primary' : 'btn btn-danger'} onClick={() => close(true)} autoFocus>
              {opts?.confirmText || 'Delete'}
            </button>
          </>
        }
      >
        <p className="text-2">{opts?.message}</p>
      </Modal>
    </ConfirmContext.Provider>
  );
}

export const useConfirm = () => useContext(ConfirmContext);
