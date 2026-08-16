export interface DemoLoginResult {
  success: boolean;
  message?: string;
}

export const DEMO_CREDENTIALS = {
  email: "demo@marketplace.test",
  password: "demo123",
};

/**
 * Isolated prototype authentication function using dummy credentials.
 * Can easily be replaced with Supabase Auth in future steps.
 */
export async function demoLogin(
  email: string,
  password: string
): Promise<DemoLoginResult> {
  // Simulate 1 second network loading latency
  await new Promise((resolve) => setTimeout(resolve, 1000));

  const cleanEmail = email.toLowerCase().trim();

  if (
    cleanEmail === DEMO_CREDENTIALS.email &&
    password === DEMO_CREDENTIALS.password
  ) {
    return { success: true };
  }

  return {
    success: false,
    message: "Incorrect email or password.",
  };
}
