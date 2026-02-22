import { type Configuration, LogLevel } from "@azure/msal-browser";

export const CLIENT_ID = "ae1fa56e-61ae-4e34-a490-2e413ade8b8d";

export const msalConfig: Configuration = {
  auth: {
    clientId: CLIENT_ID,
    // "organizations" = any Azure AD tenant (multi-tenant)
    authority: "https://login.microsoftonline.com/organizations",
    redirectUri: window.location.origin,
  },
  cache: {
    // sessionStorage clears on tab close; use "localStorage" for persistent sessions
    cacheLocation: "sessionStorage",
  },
  system: {
    loggerOptions: {
      loggerCallback: (level, message, containsPii) => {
        if (containsPii) return;
        if (level === LogLevel.Error) console.error("[MSAL]", message);
      },
      logLevel: LogLevel.Warning,
    },
  },
};

/** Scopes for the ID token used to authenticate against the backend. */
export const loginRequest = {
  scopes: ["openid", "profile", "email"],
};
