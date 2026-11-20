import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

export default class FullscreenWorkspace extends Extension {
    enable() {
        this._pending = new Set();
        this._windows = new Map();
        this._newWindows = new WeakMap();
        for (const actor of global.get_window_actors())
            this._watch(actor.get_meta_window());
        this._createdId = global.display.connect('window-created', (_display, window) => {
            const active = global.workspace_manager.get_active_workspace();
            this._newWindows.set(window, active && this._hasFullscreen(active, window) ? active : null);
            this._watch(window);
        });
        this._mapId = global.window_manager.connect('map', (_manager, actor) => {
            const window = actor.get_meta_window();
            if (!window || !this._newWindows.has(window))
                return;
            const origin = this._newWindows.get(window);
            this._newWindows.delete(window);
            this._later(() => {
                this._place(window, origin);
                this._isolate(window);
            });
        });
    }

    _later(callback) {
        const id = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            this._pending.delete(id);
            callback();
            return GLib.SOURCE_REMOVE;
        });
        this._pending.add(id);
    }

    _watch(window) {
        if (!window || this._windows.has(window))
            return;
        const fullscreenId = window.connect('notify::fullscreen', () => {
            if (window.is_fullscreen()) {
                console.log(`fullscreen-workspace: fullscreen class=${window.get_wm_class() ?? ''}`);
                // Some windows receive fullscreen before their first map signal,
                // or do not emit that signal. Never drop the transition.
                this._later(() => {
                    if (this._newWindows.has(window)) {
                        const origin = this._newWindows.get(window);
                        this._newWindows.delete(window);
                        this._place(window, origin);
                    }
                    this._isolate(window);
                });
            }
        });
        // A fullscreen window can also arrive by workspace move or restoration,
        // without changing its fullscreen property.
        const recheck = () => {
            if (!this._newWindows.has(window) && window.is_fullscreen() && !window.minimized)
                this._later(() => this._isolate(window));
        };
        const workspaceId = window.connect('workspace-changed', recheck);
        const minimizedId = window.connect('notify::minimized', recheck);
        const unmanagedId = window.connect('unmanaged', () => {
            for (const id of this._windows.get(window) ?? [])
                window.disconnect(id);
            this._windows.delete(window);
        });
        this._windows.set(window, [fullscreenId, workspaceId, minimizedId, unmanagedId]);
    }

    _hasFullscreen(workspace, except) {
        return workspace.list_windows().some(window =>
            window !== except && window.get_window_type() === Meta.WindowType.NORMAL &&
            window.is_fullscreen() && !window.minimized);
    }

    _isUtility(window) {
        const ids = [window.get_wm_class(), window.get_wm_class_instance(),
            window.get_gtk_application_id()];
        return ids.some(id => [
            'handy', 'com.pais.handy', 'io.github.bugaevc.wl-clipboard',
            'ulauncher', 'io.ulauncher.ulauncher', 'net.launchpad.ulauncher',
        ].includes((id ?? '').toLowerCase()));
    }

    _ordinary(window) {
        return window && window.get_window_type() === Meta.WindowType.NORMAL &&
            !window.get_transient_for() && !window.is_on_all_workspaces() && !this._isUtility(window);
    }

    _place(window, origin) {
        if (!this._ordinary(window))
            return;
        const source = window.get_workspace();
        if (!source || (!this._hasFullscreen(source, window) &&
            !(origin && this._hasFullscreen(origin, window))))
            return;
        const manager = global.workspace_manager;
        let target = manager.get_workspace_by_index(0);
        if (!target)
            return;
        if (this._hasFullscreen(target, window))
            target = manager.append_new_workspace(false, global.get_current_time());
        if (!target)
            return;
        const active = manager.get_active_workspace();
        const follow = active === source || active === origin;
        if (target !== source)
            window.change_workspace(target);
        if (follow && active !== target)
            target.activate_with_focus(window, global.get_current_time());
    }

    _isolate(window) {
        if (!this._ordinary(window) || !window.is_fullscreen() || window.minimized)
            return;
        const source = window.get_workspace();
        if (!source)
            return;
        const others = source.list_windows().filter(other =>
            other !== window && other.get_workspace() === source && this._ordinary(other));
        if (!others.length) {
            console.log('fullscreen-workspace: no movable windows on fullscreen workspace');
            return;
        }
        const manager = global.workspace_manager;
        let target = manager.get_workspace_by_index(0);
        if (!target)
            return;
        if (target === source) {
            target = manager.append_new_workspace(false, global.get_current_time());
            if (!target)
                return;
            manager.reorder_workspace(target, 0);
        } else if (this._hasFullscreen(target, null)) {
            target = manager.append_new_workspace(false, global.get_current_time());
        }
        if (!target || target === source)
            return;
        for (const other of others)
            other.change_workspace(target);
        console.log(`fullscreen-workspace: moved ${others.length} windows`);
    }

    disable() {
        global.window_manager.disconnect(this._mapId);
        global.display.disconnect(this._createdId);
        for (const id of this._pending)
            GLib.source_remove(id);
        this._pending.clear();
        for (const [window, ids] of this._windows)
            ids.forEach(id => window.disconnect(id));
        this._windows.clear();
    }
}
