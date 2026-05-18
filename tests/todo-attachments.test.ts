import * as assert from "node:assert/strict";
import {
  isTodoAttachmentBucketAlreadyExists,
  isTodoAttachmentBucketMissing,
  safeTodoAttachmentName,
  todoAttachmentMarkdown,
} from "../lib/todo-attachments";

assert.equal(safeTodoAttachmentName("Capture d’écran [client].png"), "Capture-d-ecran-client-.png");
assert.equal(safeTodoAttachmentName("***"), "piece-jointe");
assert.equal(
  todoAttachmentMarkdown("photo [avant].png", "https://example.com/photo.png", "image/png"),
  "![photo avant.png](https://example.com/photo.png)",
);
assert.equal(
  todoAttachmentMarkdown("brief.pdf", "https://example.com/brief.pdf", "application/pdf"),
  "[brief.pdf](https://example.com/brief.pdf)",
);
assert.equal(isTodoAttachmentBucketMissing({ message: "Bucket not found" }), true);
assert.equal(isTodoAttachmentBucketMissing({ statusCode: "404" }), true);
assert.equal(isTodoAttachmentBucketAlreadyExists({ statusCode: "409" }), true);
assert.equal(isTodoAttachmentBucketAlreadyExists({ message: "The resource already exists" }), true);

console.log("todo-attachments tests passed");
