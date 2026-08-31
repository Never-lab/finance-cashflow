import type { SessionPayload } from "./authSession";

export type AppVariables = {
  session: SessionPayload;
};

export type AppEnv = { Variables: AppVariables };
