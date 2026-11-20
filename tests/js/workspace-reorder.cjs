const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
let code = fs.readFileSync(process.argv[2], 'utf8').replace(/^import .*;\n/gm, '')
    .replace('export default class WorkspaceReorder extends Extension', 'class WorkspaceReorder extends Extension');
code += '\nthis.WorkspaceReorder = WorkspaceReorder;';
class Thumbnail {
    constructor(index, x) { this.metaWorkspace = {index: () => index}; this.x = x; this.width = 100; this.state = 4; this.reactive = false; this._delegate = this; this.actions = []; this.children = []; }
    add_child(child) { this.children.push(child); child.parent = this; }
    connect() { return 1; } disconnect() {} add_action(a) { this.actions.push(a); }
    remove_action(a) { this.actions = this.actions.filter(x => x !== a); }
    get_transformed_size() { return [100, 60]; }
}
const thumbnails = [new Thumbnail(0, 0), new Thumbnail(1, 110), new Thumbnail(2, 220)];
const placeholder = {min_width_set: false, min_width: 0, natural_width_set: false, natural_width: 0,
    set_width(width) { this.min_width = width; this.natural_width = width; this.min_width_set = this.natural_width_set = true; }};
const box = {height: 60, _dropPlaceholder: placeholder, _dropPlaceholderPos: -1, _dropWorkspace: -1, queue_relayout() {}, _thumbnails: thumbnails, get_children: () => thumbnails,
    connect(_signal, cb) { this.childAdded = cb; return 1; }, disconnect() {},
    handleDragOver() { return 'original-over'; }, acceptDrop() { return 'original-drop'; }};
let dynamic = true, reordered;
const global = {workspace_manager: {n_workspaces: 3, reorder_workspace(ws, i) { reordered = [ws, i]; }}, get_current_time: () => 1};
const DND = {DragMotionResult: {NO_DROP: 0, MOVE_DROP: 2, COPY_DROP: 1}, makeDraggable(actor) { const gesture = {set_phase() {}}; actor.add_action(gesture); return {_dndGesture: gesture, connect() {}}; }};
const display = {get_children: () => [], connect() {return 1;}, disconnect() {}};
const adjustment = {value: 1, connect() {return 1;}, disconnect() {}};
const controls = {_thumbnailsBox: box, _workspacesDisplay: display, _stateAdjustment: adjustment};
class Button {
    constructor(props) { Object.assign(this, props); this.actions = []; }
    add_action(a) { this.actions.push(a); }
    destroy() { this.destroyed = true; }
}
const context = {Extension: class {}, St: {Button}, DND, global, Clutter: {Clone: class {}, EventPhase: {CAPTURE: 1}, ActorAlign: {START: 1}, TextDirection: {RTL: 1}, get_default_text_direction: () => 0}, Meta: {prefs_get_dynamic_workspaces: () => dynamic},
    WorkspaceThumbnail: {WorkspaceThumbnail: Thumbnail, ThumbnailState: {NORMAL: 4}}, Main: {layoutManager: {primaryIndex: 0}, overview: {_overview: {controls}}}};
vm.runInNewContext(code, context);
const extension = new context.WorkspaceReorder(); extension.enable();
const handles = thumbnails.map(t => extension._items.get(t).source);
assert.strictEqual(thumbnails[0].actions.length, 0); assert.strictEqual(thumbnails[0].children.length, 1);
assert.strictEqual(box.handleDragOver({}, null, 0, 0, 0), 'original-over');
assert.strictEqual(box.acceptDrop({}, null, 0, 0, 0), 'original-drop');
assert.strictEqual(box.handleDragOver(handles[0], null, 160, 30, 0), 2);
assert.strictEqual(placeholder.natural_width, 100); assert.strictEqual(box._dropPlaceholderPos, 2);
// Once the gap has appeared, hovering inside its full width keeps the same slot.
placeholder.visible = true; placeholder.x = 120; placeholder.width = 100;
assert.strictEqual(box.handleDragOver(handles[0], null, 130, 30, 0), 2);
assert.strictEqual(box._dropPlaceholderPos, 2);
placeholder.visible = false;
assert.strictEqual(box.acceptDrop(handles[0], null, 160, 30, 0), true);
assert.strictEqual(reordered[0], thumbnails[0].metaWorkspace); assert.strictEqual(reordered[1], 1);
assert.strictEqual(box.handleDragOver(handles[2], null, 0, 30, 0), 0);
assert.strictEqual(box.acceptDrop(handles[0], null, 100, -1, 0), false);
assert.strictEqual(box.acceptDrop(handles[1], null, 0, 30, 0), true); assert.strictEqual(reordered[1], 0);
assert.strictEqual(box.acceptDrop(handles[0], null, 270, 30, 0), true); assert.strictEqual(reordered[1], 1);
dynamic = false; assert.strictEqual(box.acceptDrop(handles[0], null, 270, 30, 0), true); assert.strictEqual(reordered[1], 2);
// App-grid workspace previews use a separate actor hierarchy.
const preview = new Thumbnail(1, 110);
preview._container = new Thumbnail(1, 0);
preview.handleDragOver = () => 'native-preview-over'; preview.acceptDrop = () => 'native-preview-drop';
extension._addPreview(preview);
const previewState = extension._previewItems.get(preview);
assert.strictEqual(previewState.draggable._dndGesture.enabled, false); assert.strictEqual(previewState.handle.visible, false);
adjustment.value = 2; extension._updatePreviewGestures();
assert.strictEqual(previewState.draggable._dndGesture.enabled, true); assert.strictEqual(previewState.handle.visible, true);
const source = {_workspaceReorderMeta: thumbnails[0].metaWorkspace};
assert.strictEqual(preview.handleDragOver(source, null, 80, 0, 0), 2);
assert.strictEqual(preview.acceptDrop(source, null, 80, 0, 0), true);
assert.strictEqual(reordered[0], source._workspaceReorderMeta); assert.strictEqual(reordered[1], 1);
assert.strictEqual(preview.acceptDrop({}, null, 0, 0, 0), 'native-preview-drop');
assert.strictEqual(preview.acceptDrop({_workspaceReorderMeta: thumbnails[2].metaWorkspace}, null, 80, 0, 0), true); // fixed mode
dynamic = true;
assert.strictEqual(preview.acceptDrop({_workspaceReorderMeta: thumbnails[2].metaWorkspace}, null, 80, 0, 0), false);
extension.disable(); assert.strictEqual(placeholder.natural_width_set, false); assert.strictEqual(thumbnails[0].reactive, false); assert.strictEqual(thumbnails[0].actions.length, 0);
assert.strictEqual(box.handleDragOver({}, null, 0, 0, 0), 'original-over');

assert.strictEqual(preview._container._delegate, preview._container); assert.strictEqual(preview._container.actions.length, 0); assert.strictEqual(previewState.handle.destroyed, true);
assert.strictEqual(preview.acceptDrop({}, null, 0, 0, 0), 'native-preview-drop');
