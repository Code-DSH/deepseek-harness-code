import type { CloseBehavior } from "../shared/contracts.js";

export type CloseAction = "ask" | "minimize" | "quit";

export function decideCloseAction(behavior: CloseBehavior): CloseAction {
  return behavior;
}
