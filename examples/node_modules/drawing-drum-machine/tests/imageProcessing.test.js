import { expect } from '@open-wc/testing';
import { it, vi, beforeEach } from "vitest";
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const __dirname = resolve(fileURLToPath(import.meta.url), '..');
const workerCode = readFileSync(resolve(__dirname, '../src/workers/imageProcessing.js'), 'utf-8');
const jsCode = ts.transpileModule(workerCode, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ESNext,
  }
}).outputText;

/**
 * Create a 16-area dataset where each area is a 1-pixel RGBA Uint8ClampedArray.
 * @param {Array<[number,number,number]>} colors - 16 RGB tuples, one per grid cell
 */
function makeAreasData(colors) {
  return colors.map(([r, g, b]) => new Uint8ClampedArray([r, g, b, 255]));
}

function runWorker(data, channels) {
  const postMessage = vi.fn();
  const self = { postMessage };

  const patchedCode = jsCode
    .replace('"use strict";\n', '')
    .replace('onmessage = function (e) {', 'self.onmessage = function (e) {');
  const setupWorker = new Function('self', patchedCode);
  setupWorker(self);

  self.onmessage({ data: { data, channels } });

  return postMessage;
}

describe("imageProcessing worker", () => {

  describe("color matching", () => {

    it("returns all ~ when no channels are provided", () => {
      const areasData = makeAreasData(
        Array.from({ length: 16 }, () => [255, 0, 0])
      );
      const postMessage = runWorker(areasData, []);
      expect(postMessage.mock.calls).to.have.lengthOf(1);
      expect(postMessage.mock.calls[0][0]).to.deep.equal([]);
    });

    it("returns all ~ when pixel colors do not match any channel", () => {
      const areasData = makeAreasData(
        Array.from({ length: 16 }, () => [0, 0, 255])
      );
      const postMessage = runWorker(areasData, [{ _value: [255, 0, 0] }]);
      const result = postMessage.mock.calls[0][0];
      expect(result).to.have.lengthOf(1);
      expect(result[0]).to.equal("~ ".repeat(15).trim() + " ~");
    });

    it("sets 0 for cells where a pixel matches the channel color within tolerance", () => {
      const colors = Array.from({ length: 16 }, (_, i) =>
        i < 8 ? [252, 3, 2] : [0, 0, 255]
      );
      const areasData = makeAreasData(colors);
      const postMessage = runWorker(areasData, [{ _value: [255, 0, 0] }]);
      const result = postMessage.mock.calls[0][0];
      expect(result[0]).to.equal("0 0 0 0 0 0 0 0 ~ ~ ~ ~ ~ ~ ~ ~");
    });

    it("matches edge of lower tolerance boundary", () => {
      const areasData = makeAreasData(
        Array.from({ length: 16 }, () => [250, 0, 0])
      );
      const postMessage = runWorker(areasData, [{ _value: [255, 0, 0] }]);
      const result = postMessage.mock.calls[0][0];
      expect(result[0]).to.equal("0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0");
    });

    it("matches edge of upper tolerance boundary (clamped to 255)", () => {
      const areasData = makeAreasData(
        Array.from({ length: 16 }, () => [255, 5, 5])
      );
      const postMessage = runWorker(areasData, [{ _value: [255, 0, 0] }]);
      const result = postMessage.mock.calls[0][0];
      expect(result[0]).to.equal("0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0");
    });

    it("does not match when color is just outside tolerance", () => {
      const areasData = makeAreasData(
        Array.from({ length: 16 }, () => [255, 6, 0])
      );
      const postMessage = runWorker(areasData, [{ _value: [255, 0, 0] }]);
      const result = postMessage.mock.calls[0][0];
      expect(result[0]).to.equal("~ ".repeat(15).trim() + " ~");
    });

    it("matches at the lower extreme (channel [0,0,0], pixel [0,0,0])", () => {
      const areasData = makeAreasData(
        Array.from({ length: 16 }, () => [0, 0, 0])
      );
      const postMessage = runWorker(areasData, [{ _value: [0, 0, 0] }]);
      const result = postMessage.mock.calls[0][0];
      expect(result[0]).to.equal("0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0");
    });

    it("rejects when channel is [0,0,0] and pixel is just below lower bound", () => {
      const areasData = makeAreasData(
        Array.from({ length: 16 }, () => [0, 6, 0])
      );
      const postMessage = runWorker(areasData, [{ _value: [0, 0, 0] }]);
      const result = postMessage.mock.calls[0][0];
      expect(result[0]).to.equal("~ ".repeat(15).trim() + " ~");
    });

    it("matches at the upper extreme (channel [255,255,255], pixel [255,255,255])", () => {
      const areasData = makeAreasData(
        Array.from({ length: 16 }, () => [255, 255, 255])
      );
      const postMessage = runWorker(areasData, [{ _value: [255, 255, 255] }]);
      const result = postMessage.mock.calls[0][0];
      expect(result[0]).to.equal("0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0");
    });

  });

  describe("multiple channels", () => {

    it("returns one result string per channel", () => {
      const areasData = makeAreasData(
        Array.from({ length: 16 }, () => [255, 0, 0])
      );
      const channels = [
        { _value: [255, 0, 0] },
        { _value: [0, 255, 0] }
      ];
      const postMessage = runWorker(areasData, channels);
      const result = postMessage.mock.calls[0][0];
      expect(result).to.have.lengthOf(2);
    });

    it("each channel independently reflects its own matches", () => {
      const colors = Array.from({ length: 16 }, (_, i) =>
        i % 2 === 0 ? [255, 0, 0] : [0, 255, 0]
      );
      const areasData = makeAreasData(colors);
      const channels = [
        { _value: [255, 0, 0] },
        { _value: [0, 255, 0] }
      ];
      const postMessage = runWorker(areasData, channels);
      const result = postMessage.mock.calls[0][0];
      expect(result[0]).to.equal("0 ~ 0 ~ 0 ~ 0 ~ 0 ~ 0 ~ 0 ~ 0 ~");
      expect(result[1]).to.equal("~ 0 ~ 0 ~ 0 ~ 0 ~ 0 ~ 0 ~ 0 ~ 0");
    });

  });

  describe("postMessage output format", () => {

    it("posts exactly one message", () => {
      const areasData = makeAreasData(
        Array.from({ length: 16 }, () => [100, 100, 100])
      );
      const postMessage = runWorker(areasData, [{ _value: [100, 100, 100] }]);
      expect(postMessage.mock.calls).to.have.lengthOf(1);
    });

    it("returns strings with 16 space-separated tokens", () => {
      const areasData = makeAreasData(
        Array.from({ length: 16 }, () => [100, 100, 100])
      );
      const postMessage = runWorker(areasData, [{ _value: [100, 100, 100] }]);
      const tokens = postMessage.mock.calls[0][0][0].split(" ");
      expect(tokens).to.have.lengthOf(16);
    });

  });

  describe("edge cases", () => {

    it("outputs 16 tokens even with empty areasData (collector is fixed-size)", () => {
      const postMessage = runWorker([], [{ _value: [255, 0, 0] }]);
      const result = postMessage.mock.calls[0][0];
      expect(result).to.have.lengthOf(1);
      const tokens = result[0].split(" ");
      expect(tokens).to.have.lengthOf(16);
      expect(tokens).to.deep.equal(Array(16).fill("~"));
    });

    it("fills 0 for matching areas even when fewer than 16 areas provided", () => {
      const areasData = makeAreasData(
        Array.from({ length: 4 }, () => [255, 0, 0])
      );
      const postMessage = runWorker(areasData, [{ _value: [255, 0, 0] }]);
      const result = postMessage.mock.calls[0][0];
      const tokens = result[0].split(" ");
      expect(tokens).to.have.lengthOf(16);
      expect(tokens.slice(0, 4)).to.deep.equal(["0", "0", "0", "0"]);
      expect(tokens.slice(4)).to.deep.equal(Array(12).fill("~"));
    });

    it("sets 0 on all matching channels when multiple channels match the same cell", () => {
      const areasData = makeAreasData(
        Array.from({ length: 16 }, () => [255, 0, 0])
      );
      const channels = [
        { _value: [255, 0, 0] },
        { _value: [255, 5, 0] }
      ];
      const postMessage = runWorker(areasData, channels);
      const result = postMessage.mock.calls[0][0];
      expect(result).to.have.lengthOf(2);
      expect(result[0]).to.equal("0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0");
      expect(result[1]).to.equal("0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0");
    });

  });

});
