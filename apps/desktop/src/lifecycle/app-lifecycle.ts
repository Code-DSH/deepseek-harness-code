export type BeforeQuitEvent = {
  readonly preventDefault: () => void;
};

type DesktopLifecycleApp = {
  readonly whenReady: () => Promise<void>;
  readonly onActivate: (listener: () => void) => void;
  readonly onBeforeQuit: (listener: (event: BeforeQuitEvent) => void) => void;
};

type DesktopLifecycleActions = {
  readonly activate: () => void;
  readonly launch: () => Promise<void>;
  readonly shutdown: () => Promise<void>;
  readonly clearHealthTimer: () => void;
  readonly reportLaunchFailure: (error: unknown) => void;
};

export type DesktopLifecycleAuthority = {
  readonly isQuitting: () => boolean;
};

export function createSingleFlightAction(
  action: () => Promise<void>,
): () => Promise<void> {
  let inFlight: Promise<void> | undefined;
  return () => {
    inFlight ??= action();
    return inFlight;
  };
}

export function registerDesktopLifecycle(
  app: DesktopLifecycleApp,
  actions: DesktopLifecycleActions,
): DesktopLifecycleAuthority {
  let quitting = false;

  app
    .whenReady()
    .then(() => {
      app.onActivate(actions.activate);
      return actions.launch();
    })
    .catch(actions.reportLaunchFailure);

  app.onBeforeQuit((event) => {
    if (quitting) return;
    event.preventDefault();
    quitting = true;
    actions.clearHealthTimer();
    void actions.shutdown();
  });

  return { isQuitting: () => quitting };
}
