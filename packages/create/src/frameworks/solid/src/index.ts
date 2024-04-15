import { render } from "solid-js/web";

import Router from "./router";

const root = document.getElementById("app");

if (root) {
  render(Router, root);
} else {
  console.error("Root element not found!");
}
