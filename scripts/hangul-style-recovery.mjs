// Run through node_repl with its supported @oai/sky facade, not from a shell.
// Each exported action performs one input operation and then reobserves.
const observed = new WeakSet();
const consumed = new WeakSet();

const isHangul = (app) => /(?:\\|\/)Hwp\.exe$/i.test(app.id);
const styleWindows = (state) => (state.accessibility?.tree ?? '')
  .split('\n').filter((line) => /^\s*\d+ 창 스타일(?: Secondary Actions:.*)?$/.test(line));

function requireObservation(observation) {
  if (!observed.has(observation) || consumed.has(observation)) {
    throw new Error('Observe again; this recovery observation is absent or already consumed.');
  }
  consumed.add(observation);
  return observation;
}

function remember(app, state) {
  const observation = { app, state, window: state.window };
  observed.add(observation);
  return observation;
}

async function readState(sky, window, includeScreenshot) {
  const state = await sky.get_window_state({
    window, include_screenshot: includeScreenshot, include_text: true,
  });
  if (state.window.id !== window.id || state.window.app !== window.app) {
    throw new Error('Selected and observed document windows differ; recovery stopped.');
  }
  if (typeof state.accessibility?.tree !== 'string' || !state.accessibility.tree.trim()) {
    throw new Error('Accessibility state is unavailable; dialog closure is unverified.');
  }
  return state;
}

/** Observation cell: select exactly the returned document with the requested title. */
export async function observeStyleRecovery(sky, documentTitle) {
  if (typeof documentTitle !== 'string' || !documentTitle.trim()) {
    throw new Error('An exact title from a returned Hangul Window is required.');
  }
  const candidates = (await sky.list_apps()).filter(isHangul)
    .flatMap((app) => app.windows.filter((window) => window.title === documentTitle)
      .map((window) => ({ app, window })));
  if (candidates.length !== 1) {
    throw new Error(`Expected one returned document window; found ${candidates.length}.`);
  }
  const { app, window } = candidates[0];
  const selected = await sky.get_window({ id: window.id, app: window.app });
  const state = await readState(sky, selected, false);
  return remember(app, state);
}

/** Print this summary and inspect it before using an action in the next cell. */
export function summarizeStyleRecovery(observation) {
  return {
    windowId: observation.window.id,
    styleDialogPresent: styleWindows(observation.state).length === 1,
    focused: observation.state.accessibility?.focused_element ?? null,
  };
}

/** Action cell: ask the existing Hangul app to launch, then check the same document. */
export async function dismissStyleViaLauncher(sky, observation) {
  const current = requireObservation(observation);
  if (styleWindows(current.state).length !== 1) {
    throw new Error('Exactly one observed Style dialog is required; no launch performed.');
  }
  // This is a tested launcher recovery, not a general modal cancel operation.
  // Avoid using it while editing nested style properties or other dialogs.
  const nestedDialog = (current.state.accessibility?.tree ?? '').split('\n')
    .some((line) => /^\s*\d+ 창 (?:스타일 편집|스타일 추가|글자 모양|문단 모양)/.test(line));
  if (nestedDialog) throw new Error('Nested style dialog is unsupported; no launch performed.');
  await sky.launch_app({ app: current.app.id });
  const state = await readState(sky, current.window, false);
  if (styleWindows(state).length !== 0) {
    throw new Error('Launcher did not dismiss Style; reobserve instead of retrying blindly.');
  }
  return remember(current.app, state);
}

/** Next action cell: foreground the recovered document, then inspect its screenshot. */
export async function focusRecoveredDocument(sky, observation) {
  const current = requireObservation(observation);
  if (styleWindows(current.state).length !== 0) {
    throw new Error('Style remains open; no parent activation performed.');
  }
  await sky.activate_window({ window: current.window });
  const state = await readState(sky, current.window, true);
  if (styleWindows(state).length !== 0) {
    throw new Error('Style is present after activation; recovery is not verified.');
  }
  return remember(current.app, state);
}
