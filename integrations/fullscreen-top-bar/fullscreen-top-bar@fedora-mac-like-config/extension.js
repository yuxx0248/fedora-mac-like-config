import GLib from 'gi://GLib';
import Clutter from 'gi://Clutter';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

const INTERVAL_MS = 100;
const ANIMATION_MS = 180;

export default class FullscreenTopBar extends Extension {
    enable() {
        this._revealed = false;
        this._ownsPanel = false;
        this._timer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, INTERVAL_MS, () => {
            this._update();
            return GLib.SOURCE_CONTINUE;
        });
        this._update();
    }

    _update() {
        const layout = Main.layoutManager;
        const panel = layout.panelBox;
        const monitor = layout.primaryMonitor;
        // Let Shell own visibility in overview, on the lock screen, and outside fullscreen.
        if (!monitor || !monitor.inFullscreen || !global.window_group.visible ||
            !Main.sessionMode.hasWindows) {
            if (this._ownsPanel) {
                this._ownsPanel = false;
                this._revealed = false;
                panel.remove_all_transitions();
                panel.translation_y = 0;
                layout._updateVisibility();
            }
            return;
        }

        const [x, y] = global.get_pointer();
        const insideX = x >= monitor.x && x < monitor.x + monitor.width;
        const atEdge = insideX && y >= monitor.y && y < monitor.y + 2;
        const overPanel = insideX && y >= monitor.y && y < monitor.y + panel.height;
        const menuOpen = !!Main.panel.menuManager.activeMenu;
        const reveal = atEdge || (this._revealed && (overPanel || menuOpen));
        this._ownsPanel = true;
        if (reveal === this._revealed) {
            // Shell can hide tracked chrome again when fullscreen state changes.
            if (reveal && !panel.visible)
                panel.show();
            return;
        }

        this._revealed = reveal;
        panel.remove_all_transitions();
        if (reveal) {
            panel.translation_y = -panel.height;
            panel.show();
            panel.ease({translation_y: 0, duration: ANIMATION_MS,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD});
        } else {
            panel.ease({translation_y: -panel.height, duration: ANIMATION_MS,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                onComplete: () => {
                    if (this._ownsPanel && !this._revealed) {
                        panel.hide();
                        panel.translation_y = 0;
                    }
                }});
        }
    }

    disable() {
        if (this._timer) {
            GLib.source_remove(this._timer);
            this._timer = 0;
        }
        if (this._ownsPanel) {
            const layout = Main.layoutManager;
            layout.panelBox.remove_all_transitions();
            layout.panelBox.translation_y = 0;
            this._ownsPanel = false;
            layout._updateVisibility();
        }
    }
}
