import * as assert from "node:assert/strict";
import { parseTodoDescriptionParts } from "../lib/todo-description-preview";

assert.deepEqual(parseTodoDescriptionParts("Avant ![capture](https://example.com/capture.png) après"), [
  { type: "text", text: "Avant " },
  { type: "image", alt: "capture", url: "https://example.com/capture.png" },
  { type: "text", text: " après" },
]);

assert.deepEqual(parseTodoDescriptionParts("Voir [brief.pdf](https://example.com/brief.pdf)"), [
  { type: "text", text: "Voir " },
  { type: "link", label: "brief.pdf", url: "https://example.com/brief.pdf" },
]);

assert.deepEqual(parseTodoDescriptionParts("![ ](https://example.com/image.png)"), [
  { type: "image", alt: " ", url: "https://example.com/image.png" },
]);

console.log("todo-description-preview tests passed");
