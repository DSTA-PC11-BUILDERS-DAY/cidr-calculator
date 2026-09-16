import test from "node:test";
import assert from "node:assert/strict";
import { calculate, vlsm, _internal } from "../lib/cidr.js";

test("ip <-> int round trip", () => {
  assert.equal(_internal.intToIp(_internal.ipToInt("192.168.1.10")), "192.168.1.10");
  assert.equal(_internal.intToIp(_internal.ipToInt("0.0.0.0")), "0.0.0.0");
  assert.equal(_internal.intToIp(_internal.ipToInt("255.255.255.255")), "255.255.255.255");
});

test("calculate a standard /24", () => {
  const r = calculate("192.168.1.10", 24);
  assert.equal(r.networkAddress, "192.168.1.0");
  assert.equal(r.broadcastAddress, "192.168.1.255");
  assert.equal(r.netmask, "255.255.255.0");
  assert.equal(r.wildcardMask, "0.0.0.255");
  assert.equal(r.firstUsableHost, "192.168.1.1");
  assert.equal(r.lastUsableHost, "192.168.1.254");
  assert.equal(r.usableHosts, "254");
  assert.equal(r.totalAddresses, "256");
  assert.equal(r.isPrivate, true);
  assert.equal(r.ipClass, "C");
});

test("calculate handles /31 and /32 without usable hosts", () => {
  const r31 = calculate("10.0.0.0", 31);
  assert.equal(r31.networkAddress, "10.0.0.0");
  assert.equal(r31.broadcastAddress, "10.0.0.1");
  assert.equal(r31.usableHosts, "0");

  const r32 = calculate("10.0.0.5", 32);
  assert.equal(r32.networkAddress, "10.0.0.5");
  assert.equal(r32.broadcastAddress, "10.0.0.5");
  assert.equal(r32.usableHosts, "0");
});

test("calculate handles /0 and non-octet-aligned prefixes", () => {
  const r0 = calculate("8.8.8.8", 0);
  assert.equal(r0.networkAddress, "0.0.0.0");
  assert.equal(r0.broadcastAddress, "255.255.255.255");
  assert.equal(r0.totalAddresses, "4294967296");

  const r22 = calculate("172.16.5.130", 22);
  assert.equal(r22.networkAddress, "172.16.4.0");
  assert.equal(r22.broadcastAddress, "172.16.7.255");
  assert.equal(r22.usableHosts, "1022");
});

test("calculate rejects invalid input", () => {
  assert.throws(() => calculate("999.1.1.1", 24), /Invalid IPv4 address/);
  assert.throws(() => calculate("192.168.1.1", 33), /Invalid prefix/);
  assert.throws(() => calculate("192.168.1", 24), /Invalid IPv4 address/);
});

test("vlsm allocates subnets largest first without overlap", () => {
  const plan = vlsm("192.168.1.0/24", [
    { name: "Sales", hosts: 50 },
    { name: "Engineering", hosts: 20 },
    { name: "WAN", hosts: 2 },
  ]);

  assert.equal(plan.allocations.length, 3);
  assert.equal(plan.allocations[0].name, "Sales");
  assert.equal(plan.allocations[0].cidr, "192.168.1.0/26");
  assert.equal(plan.allocations[0].usableHosts, "62");
  assert.equal(plan.allocations[1].cidr, "192.168.1.64/27");
  assert.equal(plan.allocations[2].cidr, "192.168.1.96/30");
  assert.equal(plan.allocatedAddresses, "100");
  assert.equal(plan.freeAddresses, "156");
  assert.equal(plan.utilization, "39.1%");

  const starts = plan.allocations.map((a) => a.networkAddress);
  assert.deepEqual(starts, [...new Set(starts)]);
});

test("vlsm throws when requirements exceed the base network", () => {
  assert.throws(
    () => vlsm("192.168.1.0/28", [{ name: "Big", hosts: 50 }]),
    /not enough space/
  );
});

test("vlsm validates requirements", () => {
  assert.throws(() => vlsm("192.168.1.0/24", []), /At least one subnet/);
  assert.throws(() => vlsm("192.168.1.0/24", [{ name: "x", hosts: 0 }]), /Invalid host requirement/);
});
