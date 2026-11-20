import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

// GNOME 51 reserves 15% of the overview height for the workspace row on
// the applications page. Use the same upper bound for overview thumbnails.
const WORKSPACE_SCALE = 0.15;

export default class OverviewWorkspaceSize extends Extension {
    enable() {
        this._controls = Main.overview._overview.controls;
        this._thumbnails = this._controls._thumbnailsBox;
        this._previousScale = this._thumbnails._maxThumbnailScale;
        this._hadOwnUpdate = Object.prototype.hasOwnProperty.call(this._thumbnails, '_updateShouldShow');
        this._previousUpdate = this._thumbnails._updateShouldShow;
        this._showThumbnails = () => {
            const shouldShow = global.workspace_manager.n_workspaces > 0;
            if (this._thumbnails._shouldShow !== shouldShow) {
                this._thumbnails._shouldShow = shouldShow;
                this._thumbnails.notify('should-show');
            }
        };
        this._thumbnails._updateShouldShow = this._showThumbnails;
        this._thumbnails._maxThumbnailScale = WORKSPACE_SCALE;
        this._showThumbnails();
        this._relayout();
    }

    _relayout() {
        this._thumbnails.queue_relayout();
        this._controls.layout_manager.layout_changed();
    }

    disable() {
        if (this._thumbnails._updateShouldShow === this._showThumbnails) {
            if (this._hadOwnUpdate)
                this._thumbnails._updateShouldShow = this._previousUpdate;
            else
                delete this._thumbnails._updateShouldShow;
            this._thumbnails._updateShouldShow();
        }
        // Avoid undoing a later change from another extension.
        if (this._thumbnails._maxThumbnailScale === WORKSPACE_SCALE) {
            this._thumbnails._maxThumbnailScale = this._previousScale;
            this._relayout();
        }
    }
}
