import { expect, fixture, html } from '@open-wc/testing';
import { it, vi, beforeEach } from "vitest";

vi.hoisted(() => {
  class MockWorker {
    constructor() {
      this.onmessage = null;
    }
    postMessage() {}
    addEventListener() {}
    removeEventListener() {}
    terminate() {}
  }
  globalThis.Worker = MockWorker;
});

import Channels from "../src/channels"

vi.mock(import("../src/feedProcessor"));

import FeedProcessor from "../src/feedProcessor";

describe("Channels", () => {

  beforeEach(() => {

    Channels.instance = undefined;

    document.body.innerHTML = '';

  });

  describe("add", () => {

    it("creates a channel with default [0,0,0] value and selects it", async () => {
      const root = await fixture(html`<ddm-channels id="ch"></ddm-channels>`);
      const channels = document.getElementById("ch");

      const channel = channels.add();

      expect(channel).to.exist;
      expect(channel.value).to.deep.equal([0, 0, 0]);
      expect(channel.id).to.be.a("string");
      expect(channels.elements).to.have.lengthOf(1);
      expect(channels.elements[0]).to.equal(channel);
      expect(channels.selected.channel).to.equal(channel);
    });

    it("appends a toggle button to the tabs container", async () => {
      const root = await fixture(html`<ddm-channels id="ch"></ddm-channels>`);
      const channels = document.getElementById("ch");

      const channel = channels.add();

      const toggle = channels.tabs.querySelector(`[data-id="${channel.id}"]`);
      expect(toggle).to.exist;
      expect(toggle.classList.contains("button")).to.be.true;
      expect(toggle.style.backgroundColor).to.equal("rgb(0, 0, 0)");
    });

    it("creates an editor textarea element", async () => {
      const root = await fixture(html`<ddm-channels id="ch"></ddm-channels>`);
      const channels = document.getElementById("ch");

      const channel = channels.add();

      const editor = channels.editors[0];
      expect(editor).to.exist;
      expect(editor.tagName).to.equal("TEXTAREA");
      expect(editor.dataset.id).to.equal(channel.id);
      expect(editor.classList.contains("hidden")).to.be.true;
    });

    it("adds multiple channels with distinct ids", async () => {
      const root = await fixture(html`<ddm-channels id="ch"></ddm-channels>`);
      const channels = document.getElementById("ch");

      const ch1 = channels.add();
      const ch2 = channels.add();
      const ch3 = channels.add();

      expect(channels.elements).to.have.lengthOf(3);
      expect(ch1.id).to.not.equal(ch2.id);
      expect(ch2.id).to.not.equal(ch3.id);
    });

  });

  describe("select", () => {

    it("marks the selected toggle and editor with 'selected' class", async () => {
      const root = await fixture(html`<ddm-channels id="ch"></ddm-channels>`);
      const channels = document.getElementById("ch");

      const ch1 = channels.add();
      const toggle1 = channels.tabs.querySelector(`[data-id="${ch1.id}"]`);
      const editor1 = channels.editors[0];

      expect(toggle1.classList.contains("selected")).to.be.true;
      expect(editor1.classList.contains("selected")).to.be.true;

      const ch2 = channels.add();
      const toggle2 = channels.tabs.querySelector(`[data-id="${ch2.id}"]`);
      const editor2 = channels.editors[1];

      expect(toggle1.classList.contains("selected")).to.be.false;
      expect(editor1.classList.contains("selected")).to.be.false;
      expect(toggle2.classList.contains("selected")).to.be.true;
      expect(editor2.classList.contains("selected")).to.be.true;
    });

    it("updates the selected channel reference", async () => {
      const root = await fixture(html`<ddm-channels id="ch"></ddm-channels>`);
      const channels = document.getElementById("ch");

      const ch1 = channels.add();
      const ch2 = channels.add();

      const toggle1 = channels.tabs.querySelector(`[data-id="${ch1.id}"]`);
      const editor1 = channels.editors[0];
      channels.select(ch1, toggle1, editor1);

      expect(channels.selected.channel).to.equal(ch1);
      expect(channels.selected.toggle).to.equal(toggle1);
      expect(channels.selected.editor).to.equal(editor1);
    });

    it("keeps selection when re-selecting the same channel", async () => {
      const root = await fixture(html`<ddm-channels id="ch"></ddm-channels>`);
      const channels = document.getElementById("ch");

      const ch1 = channels.add();
      const toggle1 = channels.tabs.querySelector(`[data-id="${ch1.id}"]`);
      const editor1 = channels.editors[0];

      channels.select(ch1, toggle1, editor1);

      expect(toggle1.classList.contains("selected")).to.be.true;
      expect(editor1.classList.contains("selected")).to.be.true;
      expect(channels.selected.channel).to.equal(ch1);
    });

  });

  describe("delete", () => {

    it("removes the selected channel element and resets selection", async () => {
      const root = await fixture(html`<ddm-channels id="ch"></ddm-channels>`);
      const channels = document.getElementById("ch");

      channels.add();
      channels.add();

      expect(channels.elements).to.have.lengthOf(2);

      channels.delete();

      expect(channels.elements).to.have.lengthOf(1);
      expect(channels.selected.channel).to.be.undefined;
      expect(channels.selected.toggle).to.be.undefined;
      expect(channels.selected.editor).to.be.undefined;
    });

    it("handles delete when no channels exist (empty elements)", async () => {
      const root = await fixture(html`<ddm-channels id="ch"></ddm-channels>`);
      const channels = document.getElementById("ch");

      expect(channels.elements).to.have.lengthOf(0);

      channels.delete();

      expect(channels.elements).to.have.lengthOf(0);
      expect(channels.selected.channel).to.be.undefined;
    });

    it("handles delete when nothing is selected but elements exist", async () => {
      const root = await fixture(html`<ddm-channels id="ch"></ddm-channels>`);
      const channels = document.getElementById("ch");

      channels.add();
      channels.selected = { channel: undefined, toggle: undefined, editor: undefined };

      channels.delete();

      expect(channels.elements).to.have.lengthOf(1);
    });

    it("removes the toggle and editor DOM nodes", async () => {
      const root = await fixture(html`<ddm-channels id="ch"></ddm-channels>`);
      const channels = document.getElementById("ch");

      const ch1 = channels.add();
      const toggle1 = channels.tabs.querySelector(`[data-id="${ch1.id}"]`);
      const editor1 = channels.editors[0];

      channels.delete();

      expect(document.body.contains(toggle1)).to.be.false;
      expect(document.body.contains(editor1)).to.be.false;
    });

    it("returns the Channels instance for chaining", () => {
      const channels = document.createElement("ddm-channels");
      const result = channels.delete();
      expect(result).to.equal(channels);
    });

  });

  describe("find", () => {

    it("returns the editor index by channel id", async () => {
      const root = await fixture(html`<ddm-channels id="ch"></ddm-channels>`);
      const channels = document.getElementById("ch");

      const ch1 = channels.add();
      const ch2 = channels.add();

      expect(channels.find(ch1.id)).to.equal(0);
      expect(channels.find(ch2.id)).to.equal(1);
    });

    it("returns -1 when the id is not found", async () => {
      const root = await fixture(html`<ddm-channels id="ch"></ddm-channels>`);
      const channels = document.getElementById("ch");

      channels.add();

      expect(channels.find("nonexistent")).to.equal(-1);
    });

  });

  describe("values", () => {

    it("returns the textarea values for all channels", async () => {
      const root = await fixture(html`<ddm-channels id="ch"></ddm-channels>`);
      const channels = document.getElementById("ch");

      channels.add();
      channels.add();

      channels.editors[0].value = 's("bd")';
      channels.editors[1].value = 's("hh")';

      expect(channels.values).to.deep.equal(['s("bd")', 's("hh")']);
    });

    it("returns empty strings for channels with no editor input", async () => {
      const root = await fixture(html`<ddm-channels id="ch"></ddm-channels>`);
      const channels = document.getElementById("ch");

      channels.add();

      const vals = channels.values;
      expect(vals).to.have.lengthOf(1);
      expect(vals[0]).to.equal("");
    });

  });

  describe("modify", () => {

    it("throws when no channel is selected", async () => {
      const root = await fixture(html`<ddm-channels id="ch"></ddm-channels>`);
      const channels = document.getElementById("ch");

      expect(() => channels.modify()).to.throw("Please select a channel first");
    });

    it("does not throw when called with a selected channel", async () => {
      const root = await fixture(html`<ddm-channels id="ch"></ddm-channels>`);
      const channels = document.getElementById("ch");

      channels.add();

      expect(() => channels.modify()).not.to.throw();
    });

    it("updates the selected channel color when pixel resolves with RGB data", async () => {
      const root = await fixture(html`<ddm-channels id="ch"></ddm-channels>`);
      const channels = document.getElementById("ch");

      const pixelPromise = Promise.resolve(new Uint8ClampedArray([100, 150, 200, 255]));
      FeedProcessor.instance = { pixel: pixelPromise };

      channels.add();
      const channel = channels.selected.channel;
      const toggle = channels.selected.toggle;

      channels.modify();
      await pixelPromise;

      expect(channel.value).to.deep.equal([100, 150, 200]);
      expect(toggle.style.backgroundColor).to.equal("rgb(100, 150, 200)");
    });

    it("does not update channel when pixel resolves with a number (-1)", async () => {
      const root = await fixture(html`<ddm-channels id="ch"></ddm-channels>`);
      const channels = document.getElementById("ch");

      const pixelPromise = Promise.resolve(-1);
      FeedProcessor.instance = { pixel: pixelPromise };

      channels.add();
      const channel = channels.selected.channel;

      channels.modify();
      await pixelPromise;

      expect(channel.value).to.deep.equal([0, 0, 0]);
    });

  });

  describe("buttons", () => {

    it("add button creates a new channel", async () => {
      const root = await fixture(html`<ddm-channels id="ch"></ddm-channels>`);
      const channels = document.getElementById("ch");

      const addBtn = channels.tabs.querySelector(".button");
      addBtn.click();

      expect(channels.elements).to.have.lengthOf(1);
    });

    it("remove button deletes the selected channel", async () => {
      const root = await fixture(html`<ddm-channels id="ch"></ddm-channels>`);
      const channels = document.getElementById("ch");

      channels.add();
      expect(channels.elements).to.have.lengthOf(1);

      const buttons = channels.tabs.querySelectorAll(".button");
      const removeBtn = buttons[1];
      removeBtn.click();

      expect(channels.elements).to.have.lengthOf(0);
    });

    it("remove button does nothing when no channel is selected", async () => {
      const root = await fixture(html`<ddm-channels id="ch"></ddm-channels>`);
      const channels = document.getElementById("ch");

      channels.add();
      channels.selected = { channel: undefined, toggle: undefined, editor: undefined };

      const buttons = channels.tabs.querySelectorAll(".button");
      const removeBtn = buttons[1];
      removeBtn.click();

      expect(channels.elements).to.have.lengthOf(1);
    });

    it("toggle button selects a channel", async () => {
      const root = await fixture(html`<ddm-channels id="ch"></ddm-channels>`);
      const channels = document.getElementById("ch");

      channels.add();
      const toggle = channels.tabs.querySelector(`[data-id="${channels.elements[0].id}"]`);

      channels.selected = { channel: undefined, toggle: undefined, editor: undefined };
      toggle.click();

      expect(channels.selected.channel).to.equal(channels.elements[0]);
    });

  });

});
