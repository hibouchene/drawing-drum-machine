import { expect } from '@open-wc/testing';
import { it } from "vitest";

import { UUID } from "../src/utils"

describe("UUID", () => {

  it("returns a string", () => {
    const id = UUID();
    expect(id).to.be.a("string");
  });

  it("returns unique values on each call", () => {
    const id1 = UUID();
    const id2 = UUID();
    expect(id1).to.not.equal(id2);
  });

  it("matches a standard UUID format", () => {
    const id = UUID();
    expect(id).to.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

});
