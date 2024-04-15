/// <reference path="../env.d.ts" />

// do not import setup in Layout (or any other component);
// it would run on every component rendering;
// here instead it is running only once, on first module load.
import "./setup";

import ControlButtons from "./ControlButtons.vue";
import CreateDialog from "./CreateDialog.vue";
import EditorPlaceholder from "./EditorPlaceholder.vue";
import Layout from "./Layout.vue";
import Pager from "./Pager.vue";

export { ControlButtons, CreateDialog, EditorPlaceholder, Layout, Pager };

export * from "./assets";
export * from "./store";
export * from "./handlers";
export * from "./fetch";
