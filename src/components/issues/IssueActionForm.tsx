"use client";

import { createContext, useContext, useId, useRef, useState, useTransition, type FormHTMLAttributes } from "react";
import type { IssueFormResult } from "@/lib/issue-validation";

const FormState = createContext<{ pending: boolean; result: IssueFormResult; errorPrefix: string }>({ pending: false, result: {}, errorPrefix: "issue-error" });
export function useIssueFormState() { return useContext(FormState); }

export function IssueFieldError({ field }: { field: string }) {
  const { result, errorPrefix } = useIssueFormState();
  return result.fieldErrors?.[field] ? <p id={`${errorPrefix}-${field}`} role="alert" className="mt-1 text-xs text-danger">{result.fieldErrors[field]}</p> : null;
}

/** Submit manually so React's successful-action reset cannot erase an invalid draft. */
export function IssueActionForm({ action, children, ...props }: Omit<FormHTMLAttributes<HTMLFormElement>, "action"> & {
  action: (form: FormData) => Promise<IssueFormResult | void>;
}) {
  const [result, setResult] = useState<IssueFormResult>({});
  const [pending, startTransition] = useTransition();
  const inFlight = useRef(false);
  const errorPrefix = useId();
  return <FormState.Provider value={{ pending, result, errorPrefix }}>
    <form {...props} aria-busy={pending} onSubmit={(event) => {
      event.preventDefault();
      if (inFlight.current) return;
      inFlight.current = true;
      const form = event.currentTarget;
      const data = new FormData(form);
      startTransition(async () => {
        try {
          const next = await action(data) || {};
          setResult(next);
          for (const element of Array.from(form.elements)) {
            if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement)) continue;
            const error = next.fieldErrors?.[element.name];
            element.setAttribute("aria-invalid", error ? "true" : "false");
            if (error) element.setAttribute("aria-describedby", `${errorPrefix}-${element.name}`);
            else if (element.getAttribute("aria-describedby")?.startsWith(`${errorPrefix}-`)) element.removeAttribute("aria-describedby");
          }
          if (next.error) form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
        } catch (error) {
          if (error && typeof error === "object" && "digest" in error && String(error.digest).startsWith("NEXT_REDIRECT")) throw error;
          setResult({ error: "The request could not be completed. Your entries are preserved. Check the issue list before retrying a new report." });
        } finally { inFlight.current = false; }
      });
    }}>
      {result.error && <p role="alert" className="rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger">{result.error}</p>}
      {pending && <p role="status" className="p-2 text-xs text-muted-foreground">Saving...</p>}
      {children}
    </form>
  </FormState.Provider>;
}
