import { useCallback, useEffect, useState } from "react";
import { invoiceService } from "../db/invoiceService";
import { productService } from "../db/productService";
import { Invoice, InvoiceWithItems, Product, UserSession } from "../types";

// Generic hook for async data fetching with loading and error states
export function useAsync<T>(
  asyncFn: () => Promise<T>,
  dependencies: unknown[] = []
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const execute = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await asyncFn();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, dependencies);

  useEffect(() => {
    execute();
  }, [execute]);

  return { data, loading, error, refetch: execute, setData };
}

// Products hook with CRUD operations
export function useProducts() {
  const { data: products, loading, error, refetch } = useAsync<Product[]>(
    async () => {
      return productService.getAll();
    },
    []
  );

  const addProduct = useCallback(async (product: Omit<Product, "updated_at">) => {
    await productService.add(product);
    await refetch();
  }, [refetch]);

  const updateProduct = useCallback(async (product: Product) => {
    await productService.update(product);
    await refetch();
  }, [refetch]);

  const deleteProduct = useCallback(async (id: string) => {
    await productService.delete(id);
    await refetch();
  }, [refetch]);

  const updateQuantity = useCallback(async (id: string, delta: number) => {
    await productService.updateQuantity(id, delta);
    await refetch();
  }, [refetch]);

  return {
    products: products ?? [],
    loading,
    error,
    refetch,
    addProduct,
    updateProduct,
    deleteProduct,
    updateQuantity,
  };
}

// Invoices hook with operations
export function useInvoices() {
  const { data: invoices, loading, error, refetch } = useAsync<Invoice[]>(
    async () => {
      return invoiceService.getAll();
    },
    []
  );

  const getInvoiceWithItems = useCallback(async (invoiceId: string): Promise<InvoiceWithItems | null> => {
    const invoice = invoices?.find(inv => inv.id === invoiceId);
    if (!invoice) return null;
    
    const items = await invoiceService.getItems(invoiceId);
    return { ...invoice, items };
  }, [invoices]);

  return {
    invoices: invoices ?? [],
    loading,
    error,
    refetch,
    getInvoiceWithItems,
  };
}

// Debounced value hook for search
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

// Keyboard shortcut hook
export function useKeyboardShortcut(
  key: string,
  callback: () => void,
  modifiers: { ctrl?: boolean; shift?: boolean; alt?: boolean } = {}
) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.key.toLowerCase() === key.toLowerCase() &&
        !!e.ctrlKey === !!modifiers.ctrl &&
        !!e.shiftKey === !!modifiers.shift &&
        !!e.altKey === !!modifiers.alt
      ) {
        e.preventDefault();
        callback();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [key, callback, modifiers.ctrl, modifiers.shift, modifiers.alt]);
}

// Local storage hook
export function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = useCallback(
    (value: T | ((val: T) => T)) => {
      try {
        const valueToStore = value instanceof Function ? value(storedValue) : value;
        setStoredValue(valueToStore);
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      } catch (error) {
        console.error("Error saving to localStorage:", error);
      }
    },
    [key, storedValue]
  );

  return [storedValue, setValue] as const;
}

// Lightweight auth session persisted to localStorage
export function useAuthSession() {
  const [session, setSession] = useLocalStorage<UserSession | null>(
    "motormods_session",
    null
  );

  const login = useCallback((nextSession: UserSession) => {
    setSession(nextSession);
  }, [setSession]);

  const logout = useCallback(() => {
    setSession(null);
  }, [setSession]);

  return { session, login, logout } as const;
}
