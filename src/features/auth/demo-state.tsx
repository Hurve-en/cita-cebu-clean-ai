import {
  createContext,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from "react";
import { useResident } from "@/features/resident/resident-state";
import { useOfficer } from "@/features/officer/officer-state";
import { useAuth } from "./auth-state";
import type { ProductRole } from "./auth-model";
type Demo = {
  role: ProductRole | null;
  start: (role: ProductRole) => void;
  end: () => void;
};
const Context = createContext<Demo | null>(null);
export function DemoProvider({ children }: PropsWithChildren) {
  const { state, client } = useAuth();
  const { dispatch } = useResident();
  const { startDemo, endDemo } = useOfficer();
  const [role, setRole] = useState<ProductRole | null>(null);
  // Subscribe to the external auth system without remounting the recovery form or navigator.
  useEffect(() => {
    if (!client) return;
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setRole(null);
        dispatch({ type: "logout" });
        endDemo();
      }
    });
    return () => data.subscription.unsubscribe();
  }, [client, dispatch, endDemo]);
  const end = () => {
    setRole(null);
    dispatch({ type: "logout" });
    endDemo();
  };
  return (
    <Context.Provider
      value={{
        role: __DEV__ && !state.user ? role : null,
        end,
        start: (next) => {
          if (!__DEV__ || state.phase !== "signedOut")
            throw Error("Sign out before opening a development preview.");
          end();
          if (next === "resident")
            dispatch({
              type: "enter",
              profile: {
                name: "Demo resident",
                email: "demo@example.com",
                barangay: "",
              },
            });
          if (next === "officer") startDemo();
          setRole(next);
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useDemo() {
  const value = useContext(Context);
  if (!value) throw Error("useDemo requires DemoProvider");
  return value;
}
