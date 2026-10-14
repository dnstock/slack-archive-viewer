import test from "node:test";
import assert from "node:assert/strict";
import { createNotice } from "../src/ui/notice.js";

test("notices expire after six seconds, can be closed, and replace old timers", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const element = { hidden: true };
  const text = { textContent: "" };
  let close;
  const show = createNotice(element, text, {
    addEventListener: (_, handler) => {
      close = handler;
    },
  });
  show("Imported an archive.");
  assert.equal(element.hidden, false);
  t.mock.timers.tick(5000);
  show("A newer notice");
  t.mock.timers.tick(1000);
  assert.equal(element.hidden, false);
  assert.equal(text.textContent, "A newer notice");
  t.mock.timers.tick(5000);
  assert.equal(element.hidden, true);
  show("Close me");
  close();
  assert.equal(element.hidden, true);
  assert.equal(text.textContent, "");
});
