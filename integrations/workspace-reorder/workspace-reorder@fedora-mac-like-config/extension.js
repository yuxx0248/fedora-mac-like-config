import Clutter from 'gi://Clutter';
import Meta from 'gi://Meta';
import St from 'gi://St';
import * as DND from 'resource:///org/gnome/shell/ui/dnd.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as WorkspaceThumbnail from 'resource:///org/gnome/shell/ui/workspaceThumbnail.js';

export default class WorkspaceReorder extends Extension {
    enable() {
        this._box = Main.overview._overview.controls._thumbnailsBox;
        this._items = new Map();
        this._previewItems = new Map();
        this._views = new Map();
        this._controls = Main.overview._overview.controls;
        this._display = this._controls._workspacesDisplay;
        this._displayChildId = this._display.connect('child-added', (_display, view) => this._watchView(view));
        this._stateId = this._controls._stateAdjustment.connect('notify::value', () => this._updatePreviewGestures());
        for (const view of this._display.get_children())
            this._watchView(view);
        this._placeholder = this._box._dropPlaceholder;
        this._placeholderSize = {
            minSet: this._placeholder.min_width_set,
            min: this._placeholder.min_width,
            naturalSet: this._placeholder.natural_width_set,
            natural: this._placeholder.natural_width,
        };
        this._dragOverOwn = Object.prototype.hasOwnProperty.call(this._box, 'handleDragOver');
        this._acceptDropOwn = Object.prototype.hasOwnProperty.call(this._box, 'acceptDrop');
        this._originalDragOver = this._box.handleDragOver;
        this._originalAcceptDrop = this._box.acceptDrop;
        this._dragOver = (source, actor, x, y, time) => {
            const thumbnail = source?._workspaceReorderThumbnail;
            if (!this._items.has(thumbnail))
                return this._originalDragOver.call(this._box, source, actor, x, y, time);
            const slot = this._slot(thumbnail, x, y);
            if (slot < 0) {
                this._clearReorderPlaceholder();
                return DND.DragMotionResult.NO_DROP;
            }
            this._placeholder.set_width(Math.round(thumbnail.width));
            this._reorderSlot = slot;
            // Shell lays out the placeholder before a thumbnail, including its
            // trailing empty thumbnail in dynamic mode.
            const marker = Math.min(slot, this._box._thumbnails.length - 1);
            this._box._dropWorkspace = -1;
            if (this._box._dropPlaceholderPos !== marker) {
                this._box._dropPlaceholderPos = marker;
                this._box.queue_relayout();
            }
            return DND.DragMotionResult.MOVE_DROP;
        };
        this._acceptDrop = (source, actor, x, y, time) => {
            const thumbnail = source?._workspaceReorderThumbnail;
            if (!this._items.has(thumbnail))
                return this._originalAcceptDrop.call(this._box, source, actor, x, y, time);
            const slot = this._slot(thumbnail, x, y);
            if (slot < 0)
                return false;
            const current = thumbnail.metaWorkspace.index();
            const index = slot > current ? slot - 1 : slot;
            this._clearReorderPlaceholder();
            global.workspace_manager.reorder_workspace(thumbnail.metaWorkspace, index);
            return true;
        };
        this._box.handleDragOver = this._dragOver;
        this._box.acceptDrop = this._acceptDrop;
        this._childAdded = this._box.connect('child-added', (_box, child) => this._add(child));
        for (const child of this._box.get_children())
            this._add(child);
    }

    _clearReorderPlaceholder() {
        this._reorderSlot = null;
        if (this._box._dropPlaceholderPos !== -1) {
            this._box._dropPlaceholderPos = -1;
            this._box.queue_relayout();
        }
    }

    _newHandle(parent, source, desktop) {
        const handle = new St.Button({
            label: '⠿', accessible_name: 'Drag to reorder workspace',
            reactive: true, can_focus: true, width: 24, height: 24,
            x_align: Clutter.ActorAlign.START, y_align: Clutter.ActorAlign.START,
            style: 'background-color: white; color: #222; border-radius: 6px; ' +
                'font-size: 16px; padding: 0; margin: 4px;',
        });
        source.getDragActor = () => {
            const [width, height] = desktop.get_transformed_size();
            return new Clutter.Clone({source: desktop, width, height, opacity: 210});
        };
        source.getDragActorSource = () => desktop;
        handle._delegate = source;
        parent.add_child(handle);
        const draggable = DND.makeDraggable(handle);
        return {handle, draggable};
    }

    _add(thumbnail) {
        if (!(thumbnail instanceof WorkspaceThumbnail.WorkspaceThumbnail) || this._items.has(thumbnail))
            return;
        const source = {_workspaceReorderThumbnail: thumbnail};
        const {handle, draggable} = this._newHandle(thumbnail, source, thumbnail);
        draggable.connect('drag-end', () => this._clearReorderPlaceholder());
        const destroyId = thumbnail.connect('destroy', () => this._items.delete(thumbnail));
        this._items.set(thumbnail, {handle, draggable, source, destroyId});
    }

    _watchView(view) {
        if (!Array.isArray(view._workspaces) || this._views.has(view) ||
            view._monitorIndex !== Main.layoutManager.primaryIndex)
            return;
        const addedId = view.connect('child-added', (_view, workspace) => this._addPreview(workspace));
        const destroyId = view.connect('destroy', () => this._views.delete(view));
        this._views.set(view, {addedId, destroyId});
        for (const workspace of view._workspaces)
            this._addPreview(workspace);
    }

    _addPreview(workspace) {
        if (!workspace?._container || !workspace.metaWorkspace || this._previewItems.has(workspace))
            return;
        const source = {_workspaceReorderMeta: workspace.metaWorkspace};
        const {handle, draggable} = this._newHandle(workspace, source, workspace);
        const originalOver = workspace.handleDragOver;
        const originalDrop = workspace.acceptDrop;
        const ownOver = Object.prototype.hasOwnProperty.call(workspace, 'handleDragOver');
        const ownDrop = Object.prototype.hasOwnProperty.call(workspace, 'acceptDrop');
        const dragOver = (item, actor, x, y, time) => {
            if (!item?._workspaceReorderMeta)
                return originalOver.call(workspace, item, actor, x, y, time);
            return this._previewSlot(item, workspace, x) < 0
                ? DND.DragMotionResult.NO_DROP : DND.DragMotionResult.MOVE_DROP;
        };
        const acceptDrop = (item, actor, x, y, time) => {
            if (!item?._workspaceReorderMeta)
                return originalDrop.call(workspace, item, actor, x, y, time);
            const slot = this._previewSlot(item, workspace, x);
            if (slot < 0)
                return false;
            const current = item._workspaceReorderMeta.index();
            global.workspace_manager.reorder_workspace(item._workspaceReorderMeta,
                slot > current ? slot - 1 : slot);
            return true;
        };
        workspace.handleDragOver = dragOver;
        workspace.acceptDrop = acceptDrop;
        const destroyId = workspace.connect('destroy', () => this._previewItems.delete(workspace));
        this._previewItems.set(workspace, {handle, source, draggable,
            originalOver, originalDrop, ownOver, ownDrop, dragOver, acceptDrop, destroyId});
        this._updatePreviewGestures();
    }

    _updatePreviewGestures() {
        // The large overview previews contain draggable app windows. Only use
        // them as workspace drag sources on the app-grid page.
        const enabled = this._controls._stateAdjustment.value > 1.5;
        for (const state of this._previewItems.values()) {
            state.handle.visible = enabled;
            state.draggable._dndGesture.enabled = enabled;
        }
    }

    _previewSlot(source, target, x) {
        const current = source._workspaceReorderMeta.index();
        const index = target.metaWorkspace.index();
        const last = global.workspace_manager.n_workspaces - 1;
        if (current < 0 || index < 0 || (Meta.prefs_get_dynamic_workspaces() && current === last))
            return -1;
        const rtl = Clutter.get_default_text_direction() === Clutter.TextDirection.RTL;
        const after = rtl ? x < target.width / 2 : x >= target.width / 2;
        const slot = index + (after ? 1 : 0);
        return Math.min(slot, Meta.prefs_get_dynamic_workspaces() ? last : last + 1);
    }

    _slot(source, x, y) {
        if (y < 0 || y > this._box.height || source.metaWorkspace.index() < 0)
            return -1;
        const thumbnails = this._box._thumbnails.filter(t =>
            t.state <= WorkspaceThumbnail.ThumbnailState.NORMAL && t.metaWorkspace.index() >= 0);
        if (!thumbnails.includes(source))
            return -1;
        const last = global.workspace_manager.n_workspaces - 1;
        const dynamic = Meta.prefs_get_dynamic_workspaces();
        if (dynamic && source.metaWorkspace.index() === last)
            return -1;

        // Keep the slot stable after the thumbnails move apart around the gap.
        if (this._reorderSlot !== null && this._reorderSlot !== undefined &&
            this._placeholder.visible && x >= this._placeholder.x &&
            x <= this._placeholder.x + this._placeholder.width)
            return this._reorderSlot;
        const rtl = Clutter.get_default_text_direction() === Clutter.TextDirection.RTL;
        let slot = thumbnails.length;
        for (let i = 0; i < thumbnails.length; i++) {
            const mid = thumbnails[i].x + thumbnails[i].width / 2;
            if (rtl ? x > mid : x < mid) {
                slot = i;
                break;
            }
        }
        // In dynamic mode insert before GNOME's trailing empty workspace.
        return Math.min(slot, dynamic ? last : thumbnails.length);
    }

    disable() {
        this._box.disconnect(this._childAdded);
        this._display.disconnect(this._displayChildId);
        this._controls._stateAdjustment.disconnect(this._stateId);
        for (const [view, state] of this._views) {
            view.disconnect(state.addedId);
            view.disconnect(state.destroyId);
        }
        this._views.clear();
        for (const [workspace, state] of this._previewItems) {
            if (state.draggable._grab)
                state.draggable._cancelDrag(global.get_current_time());
            state.handle.destroy();
            if (workspace.handleDragOver === state.dragOver) {
                if (state.ownOver) workspace.handleDragOver = state.originalOver;
                else delete workspace.handleDragOver;
            }
            if (workspace.acceptDrop === state.acceptDrop) {
                if (state.ownDrop) workspace.acceptDrop = state.originalDrop;
                else delete workspace.acceptDrop;
            }
            workspace.disconnect(state.destroyId);
        }
        this._previewItems.clear();
        this._clearReorderPlaceholder();
        this._placeholder.min_width = this._placeholderSize.min;
        this._placeholder.natural_width = this._placeholderSize.natural;
        this._placeholder.min_width_set = this._placeholderSize.minSet;
        this._placeholder.natural_width_set = this._placeholderSize.naturalSet;
        if (this._box.handleDragOver === this._dragOver) {
            if (this._dragOverOwn)
                this._box.handleDragOver = this._originalDragOver;
            else
                delete this._box.handleDragOver;
        }
        if (this._box.acceptDrop === this._acceptDrop) {
            if (this._acceptDropOwn)
                this._box.acceptDrop = this._originalAcceptDrop;
            else
                delete this._box.acceptDrop;
        }
        for (const [thumbnail, state] of this._items) {
            if (state.draggable._grab)
                state.draggable._cancelDrag(global.get_current_time());
            state.handle.destroy();
            thumbnail.disconnect(state.destroyId);
        }
        this._items.clear();
    }
}
