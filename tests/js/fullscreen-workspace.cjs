const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const path = process.argv[2];
let code = fs.readFileSync(path, 'utf8').replace(/^import .*;\n/gm, '')
    .replace('export default class FullscreenWorkspace extends Extension', 'class FullscreenWorkspace extends Extension');
code += '\nthis.FullscreenWorkspace = FullscreenWorkspace;';
let nextId = 0;
const pending = new Map();
const GLib = {PRIORITY_DEFAULT_IDLE: 0, SOURCE_REMOVE: false,
    idle_add: (_priority, callback) => { pending.set(++nextId, callback); return nextId; },
    source_remove: id => pending.delete(id)};
const Meta = {WindowType: {NORMAL: 0, DIALOG: 1}};
const manager = {workspaces: [], active: null,
    get_workspace_by_index(i) { return this.workspaces[i]; },
    get_active_workspace() { return this.active; },
    append_new_workspace() { const ws = workspace(); this.workspaces.push(ws); return ws; },
    reorder_workspace(ws, index) { this.workspaces.splice(this.workspaces.indexOf(ws), 1); this.workspaces.splice(index, 0, ws); }};
let callback, created;
const global = {workspace_manager: manager, get_current_time: () => 123, get_window_actors: () => [],
    display: {connect: (_signal, cb) => { created = cb; return 2; }, disconnect: () => { created = null; }},
    window_manager: {connect: (_signal, cb) => { callback = cb; return 1; }, disconnect: () => { callback = null; }}};
const context = {GLib, Meta, global, console: {log() {}}, Extension: class {}};
vm.runInNewContext(code, context);
function workspace() { return {windows: [], list_windows() { return this.windows; },
    activate_with_focus(win) { this.focus = win; manager.active = this; }}; }
function window(ws, options = {}) { const signals = new Map(); let signalId = 0; const w = {
    connect(name, fn) { const id = ++signalId; signals.set(id, {name, fn}); return id; },
    disconnect(id) { signals.delete(id); },
    setFullscreen() { options.fullscreen = true; for (const s of signals.values()) if (s.name === "notify::fullscreen") s.fn(); },
    setMinimized(value) { this.minimized = value; for (const s of signals.values()) if (s.name === "notify::minimized") s.fn(); },
    minimized: !!options.minimized,
    get_pid: () => 42, get_wm_class: () => options.wmClass ?? null, get_wm_class_instance: () => options.instance ?? null,
    get_gtk_application_id: () => options.appId ?? null,
    get_window_type: () => options.type ?? 0, get_transient_for: () => options.transient ?? null,
    is_on_all_workspaces: () => !!options.sticky, is_fullscreen: () => !!options.fullscreen,
    get_workspace: () => ws, change_workspace(target) { ws.windows = ws.windows.filter(x => x !== w); target.windows.push(w); ws = target; for (const s of signals.values()) if (s.name === "workspace-changed") s.fn(); }};
    ws.windows.push(w); return w; }
function flush() { while (pending.size) { const jobs = [...pending.values()]; pending.clear(); jobs.forEach(fn => fn()); } }
function map(win) { created(null, win); callback(null, {get_meta_window: () => win}); flush(); }
function setup() { const first = workspace(), source = workspace(); manager.workspaces = [first, source]; manager.active = source; return {first, source}; }
const extension = new context.FullscreenWorkspace(); extension.enable();
{
    const {first, source} = setup(); window(source, {fullscreen: true}); const newWin = window(source); map(newWin);
    assert.strictEqual(newWin.get_workspace(), first); assert.strictEqual(first.focus, newWin);
}
{
    const {first, source} = setup(); window(first, {fullscreen: true}); window(source, {fullscreen: true}); const newWin = window(source); map(newWin);
    assert.strictEqual(manager.workspaces.length, 3); assert.strictEqual(newWin.get_workspace(), manager.workspaces[2]);
}
{
    const {source} = setup(); window(source, {fullscreen: true});
    for (const options of [{type: 1}, {transient: {}}, {sticky: true}]) { const w = window(source, options); map(w); assert.strictEqual(w.get_workspace(), source); }
}
{
    const {source} = setup(); window(source, {fullscreen: true});
    for (const options of [{wmClass: 'Handy'}, {instance: 'handy'}, {appId: 'com.pais.handy'}, {wmClass: 'io.github.bugaevc.wl-clipboard'}, {wmClass: 'Ulauncher'}, {instance: 'ulauncher'}, {appId: 'io.ulauncher.Ulauncher'}]) { const w = window(source, options); map(w); assert.strictEqual(w.get_workspace(), source); }
}
{
    const {first, source} = setup(); const a = window(source), launcher = window(source, {wmClass: 'Ulauncher'});
    created(null, a); callback(null, {get_meta_window: () => a}); flush(); a.setFullscreen(); flush();
    assert.strictEqual(launcher.get_workspace(), source); assert.strictEqual(a.get_workspace(), source); assert.strictEqual(manager.workspaces[0], first);
}
{
    const {source} = setup(); window(source, {fullscreen: true, minimized: true}); const w = window(source); map(w); assert.strictEqual(w.get_workspace(), source);
}
{
    const {first, source} = setup(); window(source, {fullscreen: true}); manager.active = first; const w = window(source); map(w); assert.strictEqual(w.get_workspace(), first); assert.strictEqual(first.focus, undefined);
}
{
    const {source} = setup(); window(source, {fullscreen: true}); const w = window(source);
    callback(null, {get_meta_window: () => w}); assert.strictEqual(pending.size, 0); assert.strictEqual(w.get_workspace(), source);
    created(null, w); callback(null, {get_meta_window: () => w}); const jobs = [...pending.values()]; pending.clear(); jobs.forEach(fn => fn());
    callback(null, {get_meta_window: () => w}); assert.strictEqual(pending.size, 0);
}
{
    const {first, source} = setup(); window(source, {fullscreen: true});
    const w = window(first); map(w); assert.strictEqual(w.get_workspace(), first); assert.strictEqual(manager.active, first);
}
{
    const {first, source} = setup(); const a = window(source), b = window(source);
    created(null, a); callback(null, {get_meta_window: () => a}); flush();
    a.setFullscreen(); flush(); assert.strictEqual(a.get_workspace(), source); assert.strictEqual(b.get_workspace(), first); assert.strictEqual(manager.active, source);
}
{
    const {first} = setup(); manager.active = first; const a = window(first), b = window(first), c = window(first);
    created(null, a); callback(null, {get_meta_window: () => a}); flush();
    a.setFullscreen(); flush(); assert.strictEqual(manager.workspaces[0], b.get_workspace()); assert.strictEqual(c.get_workspace(), b.get_workspace()); assert.strictEqual(a.get_workspace(), first); assert.strictEqual(manager.active, first);
}
{
    const {first} = setup(); manager.active = first; const a = window(first), b = window(first);
    // Fullscreen notification can arrive without a preceding map signal.
    created(null, a); a.setFullscreen(); flush();
    assert.strictEqual(a.get_workspace(), first); assert.strictEqual(b.get_workspace(), manager.workspaces[0]);
    assert.notStrictEqual(b.get_workspace(), first); assert.strictEqual(manager.active, first);
}
{
    const {first, source} = setup(); window(first, {fullscreen: true}); const a = window(source), b = window(source);
    created(null, a); callback(null, {get_meta_window: () => a}); flush(); a.setFullscreen(); flush();
    assert.strictEqual(b.get_workspace(), manager.workspaces[2]); assert.strictEqual(a.get_workspace(), source);
}
{
    const {first, source} = setup(); manager.active = first; const arriving = window(first, {fullscreen: true}); map(arriving);
    const existing = window(source, {fullscreen: true});
    arriving.change_workspace(source); flush();
    assert.strictEqual(arriving.get_workspace(), source); assert.strictEqual(existing.get_workspace(), first);
}
{
    const {first, source} = setup(); const restored = window(source, {fullscreen: true, minimized: true}); map(restored);
    const existing = window(source, {fullscreen: true});
    restored.setMinimized(false); flush();
    assert.strictEqual(restored.get_workspace(), source); assert.strictEqual(existing.get_workspace(), first);
}
{
    const {source} = setup(); window(source, {fullscreen: true}); const w = window(source); created(null, w); callback(null, {get_meta_window: () => w}); extension.disable(); assert.strictEqual(pending.size, 0); assert.strictEqual(w.get_workspace(), source);
}
