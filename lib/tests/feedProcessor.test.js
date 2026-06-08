import { expect } from '@open-wc/testing';
import { it, vi, beforeEach } from "vitest";

vi.hoisted(() => {
  class MockOffscreenCanvas {
    constructor(width, height) {
      this._width = width;
      this._height = height;
      this.ctx = {
        drawImage: vi.fn(),
        getImageData: vi.fn(() => ({
          data: new Uint8ClampedArray(16)
        }))
      };
    }
    get width() { return this._width; }
    set width(v) { this._width = v; }
    get height() { return this._height; }
    set height(v) { this._height = v; }
    getContext() { return this.ctx; }
  }
  globalThis.OffscreenCanvas = MockOffscreenCanvas;

  class MockWorker {
    constructor() {
      this.onmessage = null;
      MockWorker.instances.push(this);
    }
    postMessage() {}
    addEventListener() {}
    removeEventListener() {}
    terminate() {}
  }
  MockWorker.instances = [];
  globalThis.Worker = MockWorker;
  globalThis.MockWorker = MockWorker;
});

import FeedProcessor from "../src/feedProcessor";

describe("FeedProcessor", () => {

  beforeEach(() => {
    FeedProcessor.instance = undefined;
    document.body.innerHTML = '';
  });

  function makeVideo(parentWidth, parentHeight) {
    const parent = document.createElement("div");
    Object.defineProperties(parent, {
      clientWidth: { value: parentWidth, configurable: true },
      clientHeight: { value: parentHeight, configurable: true }
    });
    const video = document.createElement("video");
    parent.appendChild(video);
    document.body.appendChild(parent);
    return video;
  }

  describe("constructor", () => {

    it("throws when video has no parent element", () => {
      const video = document.createElement("video");
      expect(() => new FeedProcessor(video)).to.throw("Video has no parent element");
    });

    it("throws when parent has zero width", () => {
      const video = makeVideo(0, 100);
      expect(() => new FeedProcessor(video)).to.throw("Parent element has zero width or height");
    });

    it("throws when parent has zero height", () => {
      const video = makeVideo(100, 0);
      expect(() => new FeedProcessor(video)).to.throw("Parent element has zero width or height");
    });

    it("creates an OffscreenCanvas with parent dimensions", () => {
      const video = makeVideo(640, 480);
      const fp = new FeedProcessor(video);
      expect(fp.frame.width).to.equal(640);
      expect(fp.frame.height).to.equal(480);
    });

    it("sets the static instance", () => {
      const video = makeVideo(100, 100);
      const fp = new FeedProcessor(video);
      expect(FeedProcessor.instance).to.equal(fp);
    });

    it("sets the video reference", () => {
      const video = makeVideo(100, 100);
      const fp = new FeedProcessor(video);
      expect(fp.video).to.equal(video);
    });

    it("updates frame dimensions on resize when video width changes", () => {
      const video = makeVideo(400, 300);
      const fp = new FeedProcessor(video);

      Object.defineProperty(video, "clientWidth", { value: 500, configurable: true });
      Object.defineProperty(video.parentElement, "clientWidth", { value: 600, configurable: true });
      Object.defineProperty(video.parentElement, "clientHeight", { value: 450, configurable: true });

      window.dispatchEvent(new Event("resize"));

      expect(fp.frame.width).to.equal(600);
      expect(fp.frame.height).to.equal(450);
    });

  });

  describe("videoToFrameScale", () => {

    it("computes correct scaling ratios", () => {
      const video = makeVideo(400, 300);
      Object.defineProperties(video, {
        videoWidth: { value: 1280, configurable: true },
        videoHeight: { value: 720, configurable: true },
        clientWidth: { value: 400, configurable: true },
        clientHeight: { value: 300, configurable: true }
      });

      const fp = new FeedProcessor(video);
      const scale = fp.videoToFrameScale();
      expect(scale.scaledWidth).to.equal(1280);
      expect(scale.scaledHeight).to.equal(720);
    });

    it("handles non-square aspect ratios", () => {
      const video = makeVideo(200, 400);
      Object.defineProperties(video, {
        videoWidth: { value: 640, configurable: true },
        videoHeight: { value: 480, configurable: true },
        clientWidth: { value: 200, configurable: true },
        clientHeight: { value: 400, configurable: true }
      });

      const fp = new FeedProcessor(video);
      const scale = fp.videoToFrameScale();
      expect(scale.scaledWidth).to.equal(640);
      expect(scale.scaledHeight).to.equal(480);
    });

  });

  describe("draw", () => {

    it("calls ctx.drawImage with correct parameters", () => {
      const video = makeVideo(400, 300);
      Object.defineProperties(video, {
        videoWidth: { value: 1280, configurable: true },
        videoHeight: { value: 720, configurable: true },
        clientWidth: { value: 400, configurable: true },
        clientHeight: { value: 300, configurable: true }
      });

      const fp = new FeedProcessor(video);
      fp.draw();
      const call = fp.ctx.drawImage.mock.calls[0];
      expect(call[0]).to.equal(video);
      expect(call[1]).to.equal(0);
      expect(call[2]).to.equal(0);
      expect(call[3]).to.equal(1280);
      expect(call[4]).to.equal(720);
      expect(call[5]).to.equal(0);
      expect(call[6]).to.equal(0);
      expect(call[7]).to.equal(400);
      expect(call[8]).to.equal(300);
    });

  });

  describe("capture", () => {

    it("resolves with an array of 16 entries", async () => {
      const video = makeVideo(400, 400);
      const fp = new FeedProcessor(video);
      const result = await fp.capture();
      expect(result).to.have.lengthOf(16);
    });

    it("calls getImageData 16 times (one per grid cell)", async () => {
      const video = makeVideo(400, 400);
      const fp = new FeedProcessor(video);
      await fp.capture();
      expect(fp.ctx.getImageData.mock.calls).to.have.lengthOf(16);
    });

    it("rejects when ctx is null", async () => {
      const video = makeVideo(100, 100);
      const fp = new FeedProcessor(video);
      fp.ctx = null;
      try {
        await fp.capture();
        expect.fail("Expected capture to reject");
      } catch (err) {
        expect(err).to.equal("Canvas ctx is null");
      }
    });

    it("captures 16 cells even when dimensions are not evenly divisible by 4", async () => {
      const video = makeVideo(101, 99);
      const fp = new FeedProcessor(video);
      const result = await fp.capture();
      expect(result).to.have.lengthOf(16);
    });

  });

  describe("process", () => {

    it("posts message to worker with data and channel elements", async () => {
      const video = makeVideo(100, 100);
      const fp = new FeedProcessor(video);
      const channels = { elements: [{ _value: [255, 0, 0] }] };
      const data = [new Uint8ClampedArray([255, 0, 0, 255])];

      const postSpy = vi.spyOn(MockWorker.instances[0], "postMessage");
      const promise = fp.process(data, channels);
      MockWorker.instances[0].onmessage({ data: ["~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~"] });

      const result = await promise;
      expect(postSpy.mock.calls[0][0].data).to.equal(data);
      expect(postSpy.mock.calls[0][0].channels).to.equal(channels.elements);
      expect(result).to.deep.equal(["~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~"]);
    });

    it("resolves with worker response for multiple channels", async () => {
      const video = makeVideo(100, 100);
      const fp = new FeedProcessor(video);
      const channels = { elements: [{ _value: [255, 0, 0] }, { _value: [0, 255, 0] }] };
      const data = [new Uint8ClampedArray(16)];

      const promise = fp.process(data, channels);
      MockWorker.instances[0].onmessage({ data: ["0 0 0 0 ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~", "~ ~ ~ ~ 0 0 0 0 ~ ~ ~ ~ ~ ~ ~ ~"] });

      const result = await promise;
      expect(result).to.have.lengthOf(2);
      expect(result[0]).to.include("0");
      expect(result[1]).to.include("0");
    });

    it("rejects when Web Workers are not supported", async () => {
      const video = makeVideo(100, 100);
      const fp = new FeedProcessor(video);
      const channels = { elements: [] };
      const data = [new Uint8ClampedArray(16)];

      const originalWorker = globalThis.Worker;
      globalThis.Worker = undefined;

      try {
        await fp.process(data, channels);
        expect.fail("Expected process to reject");
      } catch (err) {
        expect(err).to.equal("Web workers are not compatible with this navigator");
      } finally {
        globalThis.Worker = originalWorker;
      }
    });

  });

  describe("seq", () => {

    it("chains capture and process to return the sequence", async () => {
      const video = makeVideo(400, 400);
      const fp = new FeedProcessor(video);
      const channels = { elements: [{ _value: [255, 0, 0] }] };

      const promise = fp.seq(channels);
      await new Promise(r => setTimeout(r, 0));
      MockWorker.instances[0].onmessage({ data: ["0 0 0 0 ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~"] });

      const result = await promise;
      expect(result).to.be.an("array");
      expect(result[0]).to.equal("0 0 0 0 ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~");
    });

  });

  describe("pixel", () => {

    beforeEach(() => {
      MockWorker.instances = [];
    });

    it("resolves with pixel data when clicking on the video", async () => {
      const video = makeVideo(100, 100);
      video.getBoundingClientRect = vi.fn(() => ({
        top: 0, left: 0, bottom: 100, right: 100,
        width: 100, height: 100, x: 0, y: 0
      }));
      const fp = new FeedProcessor(video);

      const mockData = new Uint8ClampedArray([100, 150, 200, 255]);
      fp.ctx.getImageData = vi.fn(() => ({ data: mockData }));

      const promise = fp.pixel;
      video.dispatchEvent(new MouseEvent("mousedown", { clientX: 25, clientY: 35, bubbles: true }));
      const result = await promise;
      expect(result).to.equal(mockData);
    });

    it("resolves with -1 when clicking outside the video", async () => {
      const video = makeVideo(100, 100);
      const fp = new FeedProcessor(video);

      const promise = fp.pixel;
      window.dispatchEvent(new MouseEvent("mousedown"));
      const result = await promise;
      expect(result).to.equal(-1);
    });

    it("rejects when context is null", async () => {
      const video = makeVideo(100, 100);
      video.getBoundingClientRect = vi.fn(() => ({
        top: 0, left: 0, bottom: 100, right: 100,
        width: 100, height: 100, x: 0, y: 0
      }));
      const fp = new FeedProcessor(video);
      fp.ctx = null;

      const promise = fp.pixel;
      video.dispatchEvent(new MouseEvent("mousedown", { clientX: 10, clientY: 10, bubbles: true }));
      try {
        await promise;
        expect.fail("Expected pixel to reject");
      } catch (err) {
        expect(err).to.equal("Frame context is null");
      }
    });

  });

});
