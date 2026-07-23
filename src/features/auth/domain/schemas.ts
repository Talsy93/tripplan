import * as z from "zod";

export const credentialsSchema = z.object({
  email: z.email({ error: "יש להזין כתובת אימייל תקינה." }).trim(),
  password: z.string().min(8, { error: "הסיסמה חייבת להכיל לפחות 8 תווים." }),
});

export type Credentials = z.infer<typeof credentialsSchema>;

export type AuthFormState =
  | {
      errors?: {
        email?: string[];
        password?: string[];
      };
      message?: string;
    }
  | undefined;
