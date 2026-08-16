import type { CloseBehavior } from "../shared/contracts.js";

export type PersistedCloseBehavior = Exclude<CloseBehavior, "ask">;

export async function resolveCloseAction(
  behavior: CloseBehavior,
  choose: () => Promise<PersistedCloseBehavior>,
  persist: (value: PersistedCloseBehavior) => Promise<void>,
): Promise<PersistedCloseBehavior> {
  if (behavior !== "ask") return behavior;
  const choice = await choose();
  await persist(choice);
  return choice;
}
