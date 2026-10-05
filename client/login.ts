interface AuthSession {
  authenticated: boolean;
  email?: string;
  mustChangePassword?: boolean;
}

const loginForm = document.querySelector<HTMLFormElement>("#login-form");
const passwordForm = document.querySelector<HTMLFormElement>("#password-form");
const emailInput = document.querySelector<HTMLInputElement>("#login-email");
const authStatus = document.querySelector<HTMLParagraphElement>("#auth-status");
const returnTo = getReturnPath();

function getReturnPath(): string {
  const requested = new URLSearchParams(window.location.search).get("returnTo");
  return requested === "/dashboard" || requested?.startsWith("/dashboard/")
    ? requested
    : "/dashboard";
}

function redirectToDashboard(): void {
  window.location.replace(returnTo);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected error";
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const payload = (await response.json()) as { error?: string };
      message = payload.error || message;
    } catch {
      // Keep the status-based message when the response is not JSON.
    }

    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

function showPasswordChange(session: AuthSession): void {
  loginForm?.classList.add("hidden");
  passwordForm?.classList.remove("hidden");
  if (authStatus) {
    authStatus.textContent = `Update the password for ${session.email ?? "your account"} to continue.`;
  }
}

loginForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(loginForm);
  if (authStatus) {
    authStatus.textContent = "Signing in…";
  }

  try {
    const session = await fetchJson<AuthSession>("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: formData.get("email"),
        password: formData.get("password"),
      }),
    });
    loginForm.reset();
    if (emailInput) {
      emailInput.value = "";
    }

    if (session.mustChangePassword) {
      showPasswordChange(session);
    } else {
      redirectToDashboard();
    }
  } catch (error) {
    if (authStatus) {
      authStatus.textContent = getErrorMessage(error);
    }
  }
});

passwordForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(passwordForm);
  if (authStatus) {
    authStatus.textContent = "Updating password…";
  }

  try {
    const response = await fetch("/api/auth/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: formData.get("password") }),
    });
    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      throw new Error(payload.error ?? `Request failed (${response.status})`);
    }

    passwordForm.reset();
    redirectToDashboard();
  } catch (error) {
    if (authStatus) {
      authStatus.textContent = getErrorMessage(error);
    }
  }
});

fetchJson<AuthSession>("/api/auth/session")
  .then((session) => {
    if (!session.authenticated) {
      return;
    }

    if (session.mustChangePassword) {
      showPasswordChange(session);
      return;
    }

    redirectToDashboard();
  })
  .catch((error: unknown) => {
    if (authStatus) {
      authStatus.textContent = getErrorMessage(error);
    }
  });
