import { useCallback } from "react";
import { useMsal } from "@azure/msal-react";
import { InteractionRequiredAuthError } from "@azure/msal-browser";
import { loginRequest } from "./msalConfig";

export type AuthFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

/**
 * Returns a fetch-compatible function that automatically attaches the
 * current user's Azure AD ID token as a Bearer header.
 *
 * If the token cannot be refreshed silently the user is redirected to
 * the Microsoft login page.
 */
export function useAuthFetch(): AuthFetch {
  const { instance, accounts } = useMsal();

  return useCallback(
    async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const account = accounts[0];
      if (!account) {
        await instance.loginRedirect(loginRequest);
        throw new Error("Redirecting to login");
      }

      let idToken: string;
      try {
        const result = await instance.acquireTokenSilent({
          ...loginRequest,
          account,
        });
        idToken = result.idToken;
        // DEBUG — remove after diagnosis
        console.log("[authFetch] idToken length:", idToken?.length ?? 0, "| empty:", !idToken);
      } catch (e) {
        if (e instanceof InteractionRequiredAuthError) {
          await instance.loginRedirect(loginRequest);
          throw new Error("Redirecting to login");
        }
        throw e;
      }

      const res = await fetch(input, {
        ...init,
        headers: {
          ...(init?.headers as Record<string, string> || {}),
          Authorization: `Bearer ${idToken}`,
        },
      });

      // Return the response as-is; callers check res.ok / res.status.
      // Do NOT redirect on 401 here — a server-side validation bug would
      // create an infinite redirect loop.  Token refresh failures are already
      // handled above via InteractionRequiredAuthError.
      return res;
    },
    [instance, accounts],
  );
}
