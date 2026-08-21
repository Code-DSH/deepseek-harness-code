import {
  mergeDesktopPreferences,
  type DesktopPreferencesPatch,
  type DesktopPreferencesState,
} from "../shared/contracts.js";

export class DesktopPreferencesStore {
  private state: DesktopPreferencesState;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(
    initialState: DesktopPreferencesState,
    private readonly write: (value: DesktopPreferencesState) => Promise<void>,
  ) {
    this.state = { ...initialState };
  }

  load(value: DesktopPreferencesState): void {
    this.state = { ...value };
  }

  get(): DesktopPreferencesState {
    return { ...this.state };
  }

  update(patch: DesktopPreferencesPatch): Promise<DesktopPreferencesState> {
    return this.enqueue(async () => {
      const next = mergeDesktopPreferences(this.state, patch);
      await this.write(next);
      this.state = next;
      return this.get();
    });
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.writeQueue.then(operation);
    this.writeQueue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}
