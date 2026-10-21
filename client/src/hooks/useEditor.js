import { useCallback, useState } from 'react';
import toast from 'react-hot-toast';
import { errMsg } from '../api';

/**
 * State for a create/edit modal form.
 * `blank` is the empty form (object or factory); `fromDoc` maps an existing record to form values.
 */
export function useEditor(blank, fromDoc = (d) => d) {
  const [state, setState] = useState({ isOpen: false, editing: null, form: {} });
  const [saving, setSaving] = useState(false);

  const open = useCallback(
    (doc) =>
      setState({
        isOpen: true,
        editing: doc || null,
        form: doc ? fromDoc(doc) : typeof blank === 'function' ? blank() : { ...blank },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  const close = useCallback(() => setState((s) => ({ ...s, isOpen: false })), []);
  const set = (patch) => setState((s) => ({ ...s, form: { ...s.form, ...patch } }));

  const bind = (key) => ({
    name: key,
    value: state.form[key] ?? '',
    onChange: (e) => set({ [key]: e.target.value }),
  });
  const bindCheck = (key) => ({
    name: key,
    checked: !!state.form[key],
    onChange: (e) => set({ [key]: e.target.checked }),
  });

  const submit = async (save, successMessage) => {
    setSaving(true);
    try {
      await save(state.form, state.editing);
      toast.success(successMessage);
      close();
      return true;
    } catch (e) {
      toast.error(errMsg(e));
      return false;
    } finally {
      setSaving(false);
    }
  };

  return { ...state, saving, open, close, set, bind, bindCheck, submit };
}
