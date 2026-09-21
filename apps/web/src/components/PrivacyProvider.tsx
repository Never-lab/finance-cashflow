/**
 * Context privacy importi: toggle + persistenza; re-render albero quando cambia.
 */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  isPrivacyAmountsOn,
  loadPrivacyAmounts,
  setPrivacyAmounts,
} from "../lib/privacyAmounts";

type PrivacyContextValue = {
  masked: boolean;
  toggle: () => void;
};

const PrivacyContext = createContext<PrivacyContextValue | null>(null);

export function PrivacyProvider({ children }: { children: ReactNode }) {
  const [masked, setMasked] = useState(() => loadPrivacyAmounts());

  const toggle = useCallback(() => {
    const next = !isPrivacyAmountsOn();
    setPrivacyAmounts(next);
    setMasked(next);
  }, []);

  const value = useMemo(() => ({ masked, toggle }), [masked, toggle]);

  return <PrivacyContext.Provider value={value}>{children}</PrivacyContext.Provider>;
}

export function usePrivacyAmounts(): PrivacyContextValue {
  const ctx = useContext(PrivacyContext);
  if (!ctx) {
    throw new Error("usePrivacyAmounts must be used within PrivacyProvider");
  }
  return ctx;
}
