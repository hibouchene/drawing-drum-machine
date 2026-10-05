import { expect, fixture, html } from '@open-wc/testing';
import { it, vi, beforeEach } from "vitest";

import DDM from "../src/ddm"

import Channels from "../src/channels"
import FeedProcessor from '../src/feedProcessor';

const mockScheduler = {
    getTime: vi.fn().mockReturnValue(220),
    seconds_at_cps_change: 0,
    cps: 0,
    num_cycles_at_cps_change: 0
}

const mockUserMedia = vi.fn(async () => {
    return new Promise(resolve => { resolve() })
});

Object.defineProperty(globalThis.navigator, "mediaDevices", {
  value: {

    getUserMedia: mockUserMedia

  }
})

const feedProcessorMockFactory = vi.hoisted(() => {
  const instances = [];
  return {
    instances,
    factory: function () {
      return {
        seq: vi.fn().mockResolvedValue(["0 ~ 0 ~"]),
        capture: vi.fn(),
        process: vi.fn(),
        video: document.createElement("video"),
        frame: { width: 100, height: 100 },
        ctx: null,
      };
    }
  };
});

vi.mock(import("../src/feedProcessor"), () => ({
  default: vi.fn(feedProcessorMockFactory.factory),
}));

vi.mock('@strudel/web', () => ({
  initStrudel: vi.fn(async ({ prebake } = {}) => {
    if (prebake) prebake();
    return {
      scheduler: mockScheduler,
      setAudioContext: vi.fn(),
    };
  }),
  getAudioContext: vi.fn(async () => {
    return new AudioContext
  }),
  evaluate: vi.fn(),
  samples: vi.fn()
}));

import { evaluate, samples } from '@strudel/web';

describe("Dependencies and singleton behaviour", () => {

    beforeEach(() => {

    Channels.instance = undefined;

    document.body.innerHTML = '';
    
  });

    it('Throws error on double ddm-channels', async () => {

        const dom = await fixture(html `
            <div>
                <ddm-channels id="test1"></ddm-channels>
            </div>`);
        
        const channels1 = document.getElementById("test1");
        expect(channels1).to.exist;

        const channels2 = document.createElement("ddm-channels");
        channels2.id = "test2";

        //We simulate DOM addition by calling connectedCallback method directly

        expect(() => channels2.connectedCallback()).to.throw("You cannot add more than one instance of Channels")

        expect(channels2.isConnected).to.be.false;

        expect(Channels.instance).to.equal(channels1);

    });

    it("Throws an error when ddm-channels is not in DOM while ddm-main is",  async () => {

    const root = await fixture(html `
      <div id="root">
      </div>
      `)

    const ddm = document.createElement("ddm-main");

    expect(() => ddm.connectedCallback()).to.throw("There is no channels")
    
    })

});

describe("DDM methods", () => {

  const _origAddEventListener = window.addEventListener.bind(window);
  const _keydownHandlers = [];

  beforeEach(() => {

    Channels.instance = undefined;

    document.body.innerHTML = ``;

    window.addEventListener = function (type, handler, ...rest) {
      if (type === "keydown") _keydownHandlers.push(handler);
      return _origAddEventListener(type, handler, ...rest);
    };
    
  });

  afterEach(() => {
    window.addEventListener = _origAddEventListener;
    _keydownHandlers.splice(0).forEach((h) => {
      window.removeEventListener("keydown", h);
    });
  });

  describe("getSamples", () => {

    it("returns null when no samples attribute is set", () => {
      const ddm = document.createElement("ddm-main");
      expect(ddm.getSamples()).to.be.null;
    });

    it("returns the samples attribute value when set", () => {
      const ddm = document.createElement("ddm-main");
      ddm.setAttribute("samples", "github:foo/bar");
      expect(ddm.getSamples()).to.equal("github:foo/bar");
    });

    it("returns the full semicolon-separated string unchanged", () => {
      const ddm = document.createElement("ddm-main");
      ddm.setAttribute("samples", "github:a; github:b");
      expect(ddm.getSamples()).to.equal("github:a; github:b");
    });

    it("returns empty string when samples attribute is set to empty", () => {
      const ddm = document.createElement("ddm-main");
      ddm.setAttribute("samples", "");
      expect(ddm.getSamples()).to.equal("");
    });

  });

  describe("refresh", () => {

    beforeEach(() => {
      evaluate.mockClear();
    });

    it("calls evaluate with a stack containing setcpm and the struct", () => {
      const ddm = document.createElement("ddm-main");
      ddm.audioContext = { state: "running", resume: vi.fn() };
      ddm.refresh(['n("0 ~ 0 ~").s("bd")']);
      expect(evaluate.mock.calls).to.have.lengthOf(1);
      const arg = evaluate.mock.calls[0][0];
      expect(arg).to.contain("stack(");
      expect(arg).to.contain("setcpm(30)");
      expect(arg).to.contain('n("0 ~ 0 ~").s("bd")');
    });

    it("resumes a suspended audio context before evaluating", () => {
      const resume = vi.fn();
      const ddm = document.createElement("ddm-main");
      ddm.audioContext = { state: "suspended", resume };
      ddm.refresh(['n("0").hush()']);
      expect(resume.mock.calls).to.have.lengthOf(1);
      expect(evaluate.mock.calls).to.have.lengthOf(1);
    });

    it("does not resume a running audio context", () => {
      const resume = vi.fn();
      const ddm = document.createElement("ddm-main");
      ddm.audioContext = { state: "running", resume };
      ddm.refresh(['n("0").hush()']);
      expect(resume.mock.calls).to.have.lengthOf(0);
    });

    it("throws when audioContext is undefined", () => {
      const ddm = document.createElement("ddm-main");
      expect(() => ddm.refresh(['n("0").hush()'])).to.throw("AudioContext is not defined");
    });

    it("handles an empty struct array gracefully", () => {
      const ddm = document.createElement("ddm-main");
      ddm.audioContext = { state: "running", resume: vi.fn() };
      ddm.refresh([]);
      const arg = evaluate.mock.calls[0][0];
      expect(arg).to.contain("setcpm(30)");
    });

    it("uses the current cpm value in setcpm", () => {
      const ddm = document.createElement("ddm-main");
      ddm.audioContext = { state: "running", resume: vi.fn() };
      ddm.cpm = 60;
      ddm.refresh(['n("0").s("bd")']);
      const arg = evaluate.mock.calls[0][0];
      expect(arg).to.contain("setcpm(15)");
    });

  });

  describe("codesToStruct", () => {

    it("returns the right strudel structure for mixed empty and non-empty codes",  async () => {

      const seq = ["0 0 0 0 0 0 0 0 ~ ~ ~ ~ ~ ~ ~ ~", "0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0"];
      const codes = [`s("bd")`, ""];

      const root = await fixture(html `
        <div id="root">
          <ddm-channels></ddm-channels>
          <ddm-main id="ddm"></ddm-main>
        </div>
        `)

        const ddm = document.getElementById("ddm");

        expect(ddm.codesToStruct(seq, codes)).to.have.all.members([
          'n("0 0 0 0 0 0 0 0 ~ ~ ~ ~ ~ ~ ~ ~").s("bd")',
          'n("0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0").hush()'
        ]);
      
    });

    it("uses .hush() for empty code strings", () => {
      const ddm = document.createElement("ddm-main");
      const result = ddm.codesToStruct(["0 ~"], [""]);
      expect(result[0]).to.equal('n("0 ~").hush()');
    });

    it("appends the code modifier for non-empty codes", () => {
      const ddm = document.createElement("ddm-main");
      const result = ddm.codesToStruct(["0 ~ 0 ~"], ['s("bd")']);
      expect(result[0]).to.equal('n("0 ~ 0 ~").s("bd")');
    });

    it("returns an empty array for empty inputs", () => {
      const ddm = document.createElement("ddm-main");
      expect(ddm.codesToStruct([], [])).to.deep.equal([]);
    });

    it("produces n(\"undefined\") when seq is shorter than codes", () => {
      const ddm = document.createElement("ddm-main");
      const result = ddm.codesToStruct(["0 ~"], ['s("bd")', 's("hh")']);
      expect(result[0]).to.equal('n("0 ~").s("bd")');
      expect(result[1]).to.equal('n("undefined").s("hh")');
    });

    it("ignores extra seq items when codes is shorter than seq", () => {
      const ddm = document.createElement("ddm-main");
      const result = ddm.codesToStruct(["0 ~", "~ 0", "0 0"], ['s("bd")']);
      expect(result).to.have.lengthOf(1);
      expect(result[0]).to.equal('n("0 ~").s("bd")');
    });

    it("uses .hush() for all codes when all are empty", () => {
      const ddm = document.createElement("ddm-main");
      const result = ddm.codesToStruct(["0 0 0 0", "~ ~ ~ ~"], ["", ""]);
      expect(result[0]).to.equal('n("0 0 0 0").hush()');
      expect(result[1]).to.equal('n("~ ~ ~ ~").hush()');
    });

  });

  describe("tempo setter", () => {

    beforeEach(() => {
      evaluate.mockClear();
    });

    it("sets cpm to the given value", () => {
      const ddm = document.createElement("ddm-main");
      ddm.tempo = 240;
      expect(ddm.cpm).to.equal(240);
    });

    it("cpm/4 is used correctly in setcpm via refresh", () => {
      const ddm = document.createElement("ddm-main");
      ddm.audioContext = { state: "running", resume: vi.fn() };
      ddm.tempo = 240;
      ddm.refresh(['n("0").s("bd")']);
      const arg = evaluate.mock.calls[0][0];
      expect(arg).to.contain("setcpm(60)");
    });

    it("handles zero tempo", () => {
      const ddm = document.createElement("ddm-main");
      ddm.tempo = 0;
      expect(ddm.cpm).to.equal(0);
    });

    it("handles decimal tempo values", () => {
      const ddm = document.createElement("ddm-main");
      ddm.tempo = 100.5;
      expect(ddm.cpm).to.equal(100.5);
    });

  });

  describe("step getter", () => {

    it("returns 0 at the start of a cycle", () => {
      const ddm = document.createElement("ddm-main");
      const scheduler = {
        getTime: vi.fn().mockReturnValue(0),
        seconds_at_cps_change: 0,
        cps: 1,
        num_cycles_at_cps_change: 0
      };
      ddm.scheduler = scheduler;
      expect(ddm.step).to.equal(0);
    });

    it("returns 8 halfway through a 16-step cycle at cps=1", () => {
      const ddm = document.createElement("ddm-main");
      const scheduler = {
        getTime: vi.fn().mockReturnValue(0.5),
        seconds_at_cps_change: 0,
        cps: 1,
        num_cycles_at_cps_change: 0
      };
      ddm.scheduler = scheduler;
      expect(ddm.step).to.equal(8);
    });

    it("returns 15 on the last step before wrapping", () => {
      const ddm = document.createElement("ddm-main");
      const scheduler = {
        getTime: vi.fn().mockReturnValue(0.9375),
        seconds_at_cps_change: 0,
        cps: 1,
        num_cycles_at_cps_change: 0
      };
      ddm.scheduler = scheduler;
      expect(ddm.step).to.equal(15);
    });

    it("wraps back to 0 when a new fractional cycle begins", () => {
      const ddm = document.createElement("ddm-main");
      const scheduler = {
        getTime: vi.fn().mockReturnValue(1.0),
        seconds_at_cps_change: 0,
        cps: 1,
        num_cycles_at_cps_change: 0
      };
      ddm.scheduler = scheduler;
      expect(ddm.step).to.equal(0);
    });

    it("stays at 0 when cps is 0 regardless of elapsed time", () => {
      const ddm = document.createElement("ddm-main");
      const scheduler = {
        getTime: vi.fn().mockReturnValue(500),
        seconds_at_cps_change: 0,
        cps: 0,
        num_cycles_at_cps_change: 0
      };
      ddm.scheduler = scheduler;
      expect(ddm.step).to.equal(0);
    });

    it("accounts for cycles already elapsed via num_cycles_at_cps_change", () => {
      const ddm = document.createElement("ddm-main");
      const scheduler = {
        getTime: vi.fn().mockReturnValue(1.25),
        seconds_at_cps_change: 1,
        cps: 1,
        num_cycles_at_cps_change: 1
      };
      ddm.scheduler = scheduler;
      expect(ddm.step).to.equal(4);
    });

    it("produces negative step when elapsed time is negative", () => {
      const ddm = document.createElement("ddm-main");
      const scheduler = {
        getTime: vi.fn().mockReturnValue(0.5),
        seconds_at_cps_change: 1,
        cps: 1,
        num_cycles_at_cps_change: 0
      };
      ddm.scheduler = scheduler;
      const step = ddm.step;
      expect(step).to.equal(-8);
    });

    it("handles very high cps values", () => {
      const ddm = document.createElement("ddm-main");
      const scheduler = {
        getTime: vi.fn().mockReturnValue(0.001),
        seconds_at_cps_change: 0,
        cps: 1000,
        num_cycles_at_cps_change: 0
      };
      ddm.scheduler = scheduler;
      const step = ddm.step;
      expect(step).to.be.at.least(0).and.at.most(15);
    });

    it("throws when the scheduler is not defined", () => {
      const ddm = document.createElement("ddm-main");
      expect(() => ddm.step).to.throw("Strudel scheduler is not defined");
    });

  });

  describe("steps getter", () => {

    it("returns 0 before any step has elapsed", () => {
      const ddm = document.createElement("ddm-main");
      expect(ddm.steps).to.equal(0);
    });

    it("reflects the internal step counter", () => {
      const ddm = document.createElement("ddm-main");
      ddm._steps = 42;
      expect(ddm.steps).to.equal(42);
    });

  });

  describe("autorate", () => {

    it("defaults to auto disabled with a refresh rate of 16", () => {
      const ddm = document.createElement("ddm-main");
      expect(ddm.auto.enabled).to.be.false;
      expect(ddm.auto.refresh_rate).to.equal(16);
    });

    it("setter updates the refresh rate", () => {
      const ddm = document.createElement("ddm-main");
      ddm.autorate = 8;
      expect(ddm.auto.refresh_rate).to.equal(8);
    });

    it("reads the autorate attribute on connection", async () => {
      await fixture(html`
        <div>
          <ddm-channels></ddm-channels>
          <ddm-main id="ddm" autorate="4"></ddm-main>
        </div>
      `);
      expect(document.getElementById("ddm").auto.refresh_rate).to.equal(4);
    });

    it("keeps the default refresh rate when autorate attribute is absent", async () => {
      await fixture(html`
        <div>
          <ddm-channels></ddm-channels>
          <ddm-main id="ddm"></ddm-main>
        </div>
      `);
      expect(document.getElementById("ddm").auto.refresh_rate).to.equal(16);
    });

  });

  describe("update", () => {

    beforeEach(() => {
      evaluate.mockClear();
    });

    it("throws when the processor is not defined", () => {
      const ddm = document.createElement("ddm-main");
      ddm.channels = { values: [] };
      expect(() => ddm.update()).to.throw("FeedProcessor is not defined");
    });

    it("throws when channels are not defined", () => {
      const ddm = document.createElement("ddm-main");
      ddm.processor = { seq: vi.fn().mockResolvedValue([]) };
      expect(() => ddm.update()).to.throw("Channels are not defined");
    });

    it("computes the sequence and evaluates the resulting struct", async () => {
      const ddm = document.createElement("ddm-main");
      ddm.audioContext = { state: "running", resume: vi.fn() };
      ddm.channels = { values: ['s("bd")'] };
      ddm.processor = { seq: vi.fn().mockResolvedValue(["0 ~ 0 ~"]) };

      ddm.update();
      await new Promise(r => setTimeout(r, 0));

      expect(ddm.processor.seq.mock.calls[0][0]).to.equal(ddm.channels);
      expect(evaluate.mock.calls).to.have.lengthOf(1);
      expect(evaluate.mock.calls[0][0]).to.contain('n("0 ~ 0 ~").s("bd")');
    });

  });

  describe("autorefresh", () => {

    it("calls update when steps is a multiple of the refresh rate", () => {
      const ddm = document.createElement("ddm-main");
      ddm.update = vi.fn();
      ddm.autorate = 4;
      ddm._steps = 8;
      ddm.autorefresh();
      expect(ddm.update.mock.calls).to.have.lengthOf(1);
    });

    it("does not call update between refresh points", () => {
      const ddm = document.createElement("ddm-main");
      ddm.update = vi.fn();
      ddm.autorate = 4;
      ddm._steps = 6;
      ddm.autorefresh();
      expect(ddm.update.mock.calls).to.have.lengthOf(0);
    });

    it("does not call update when the refresh rate is 0", () => {
      const ddm = document.createElement("ddm-main");
      ddm.update = vi.fn();
      ddm.autorate = 0;
      ddm._steps = 0;
      ddm.autorefresh();
      expect(ddm.update.mock.calls).to.have.lengthOf(0);
    });

  });

  describe("start loop", () => {

    let rafCallbacks;
    let originalRaf;

    beforeEach(() => {
      rafCallbacks = [];
      originalRaf = globalThis.requestAnimationFrame;
      globalThis.requestAnimationFrame = (cb) => { rafCallbacks.push(cb); return rafCallbacks.length; };
    });

    afterEach(() => {
      globalThis.requestAnimationFrame = originalRaf;
    });

    const tick = () => rafCallbacks.shift()();

    const makeScheduler = () => ({
      time: 0,
      getTime() { return this.time; },
      seconds_at_cps_change: 0,
      cps: 1,
      num_cycles_at_cps_change: 0
    });

    it("stores the scheduler and counts each new step", () => {
      const ddm = document.createElement("ddm-main");
      const scheduler = makeScheduler();
      const step = document.createElement("div");

      ddm.start({ scheduler }, step);
      expect(ddm.scheduler).to.equal(scheduler);
      expect(ddm.steps).to.equal(1);

      //Same step: no increment
      tick();
      expect(ddm.steps).to.equal(1);

      //Next step (1/16 of a cycle)
      scheduler.time = 1 / 16;
      tick();
      expect(ddm.steps).to.equal(2);
      expect(step.style.transform).to.equal("translate(100%, 0%)");
    });

    it("ignores negative steps", () => {
      const ddm = document.createElement("ddm-main");
      const scheduler = makeScheduler();
      scheduler.seconds_at_cps_change = 1;
      scheduler.time = 0.5;

      ddm.start({ scheduler }, document.createElement("div"));
      expect(ddm.steps).to.equal(0);
    });

    it("calls autorefresh on each new step only when auto is enabled", () => {
      const ddm = document.createElement("ddm-main");
      const scheduler = makeScheduler();
      ddm.autorefresh = vi.fn();

      ddm.start({ scheduler }, document.createElement("div"));
      expect(ddm.autorefresh.mock.calls).to.have.lengthOf(0);

      ddm.auto.enabled = true;
      scheduler.time = 1 / 16;
      tick();
      expect(ddm.autorefresh.mock.calls).to.have.lengthOf(1);
    });

  });

  describe("prebake samples", () => {

    beforeEach(() => {
      samples.mockClear();
    });

    it("calls samples for each pack when samples attribute is set", async () => {
      const root = await fixture(html`
        <div>
          <ddm-channels></ddm-channels>
          <ddm-main samples="github:foo/bar; github:baz/qux"></ddm-main>
        </div>
      `);

      await new Promise(r => setTimeout(r, 0));

      expect(samples.mock.calls[0][0]).to.equal("github:foo/bar");
      expect(samples.mock.calls[1][0]).to.equal("github:baz/qux");
    });

    it("does not call samples when samples attribute is absent", async () => {
      const root = await fixture(html`
        <div>
          <ddm-channels></ddm-channels>
          <ddm-main></ddm-main>
        </div>
      `);

      await new Promise(r => setTimeout(r, 0));

      expect(samples.mock.calls).to.have.lengthOf(0);
    });

    it("handles a single sample pack without semicolon", async () => {
      const root = await fixture(html`
        <div>
          <ddm-channels></ddm-channels>
          <ddm-main samples="github:single/pack"></ddm-main>
        </div>
      `);

      await new Promise(r => setTimeout(r, 0));

      expect(samples.mock.calls).to.have.lengthOf(1);
      expect(samples.mock.calls[0][0]).to.equal("github:single/pack");
    });

  });

  describe("keydown handler", () => {

    beforeEach(() => {
      evaluate.mockClear();
    });

    it("captures sequence and evaluates Strudel on Ctrl+S", async () => {
      await fixture(html`
        <div>
          <ddm-channels id="ch"></ddm-channels>
          <ddm-main></ddm-main>
        </div>
      `);

      await new Promise(r => setTimeout(r, 50));

      const channels = document.getElementById("ch");
      channels.add();

      window.dispatchEvent(new KeyboardEvent("keydown", { key: "s", ctrlKey: true, bubbles: true }));
      await new Promise(r => setTimeout(r, 50));

      expect(evaluate.mock.calls).to.have.lengthOf(1);
      const arg = evaluate.mock.calls[0][0];
      expect(arg).to.contain("stack(");
      expect(arg).to.contain('n("0 ~ 0 ~").hush()');
    });

    it("does not evaluate on non-S keydown events", async () => {
      await fixture(html`
        <div>
          <ddm-channels></ddm-channels>
          <ddm-main></ddm-main>
        </div>
      `);

      await new Promise(r => setTimeout(r, 50));

      window.dispatchEvent(new KeyboardEvent("keydown", { key: "a", ctrlKey: true }));
      await new Promise(r => setTimeout(r, 50));

      expect(evaluate.mock.calls).to.have.lengthOf(0);
    });

    it("enables auto refresh on Ctrl+D", async () => {
      await fixture(html`
        <div>
          <ddm-channels></ddm-channels>
          <ddm-main id="ddm"></ddm-main>
        </div>
      `);

      await new Promise(r => setTimeout(r, 50));

      const ddm = document.getElementById("ddm");
      expect(ddm.auto.enabled).to.be.false;

      window.dispatchEvent(new KeyboardEvent("keydown", { key: "d", ctrlKey: true }));

      expect(ddm.auto.enabled).to.be.true;
      expect(evaluate.mock.calls).to.have.lengthOf(0);
    });

    it("disables auto refresh and updates on Ctrl+S", async () => {
      await fixture(html`
        <div>
          <ddm-channels id="ch"></ddm-channels>
          <ddm-main id="ddm"></ddm-main>
        </div>
      `);

      await new Promise(r => setTimeout(r, 50));

      document.getElementById("ch").add();
      const ddm = document.getElementById("ddm");
      ddm.auto.enabled = true;

      window.dispatchEvent(new KeyboardEvent("keydown", { key: "s", ctrlKey: true }));
      await new Promise(r => setTimeout(r, 50));

      expect(ddm.auto.enabled).to.be.false;
      expect(evaluate.mock.calls).to.have.lengthOf(1);
    });

  });

});
