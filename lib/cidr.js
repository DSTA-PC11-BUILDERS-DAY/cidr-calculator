const U32 = 0xffffffffn;

function ipToInt(ip) {
  const parts = String(ip).trim().split(".");
  if (parts.length !== 4) throw new Error(`Invalid IPv4 address: "${ip}"`);
  let value = 0n;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) throw new Error(`Invalid IPv4 address: "${ip}"`);
    const octet = Number(part);
    if (octet < 0 || octet > 255) throw new Error(`Invalid IPv4 address: "${ip}"`);
    value = (value << 8n) | BigInt(octet);
  }
  return value;
}

function intToIp(value) {
  const v = BigInt(value) & U32;
  return [24n, 16n, 8n, 0n].map((shift) => Number((v >> shift) & 0xffn)).join(".");
}

function maskFromPrefix(prefix) {
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) {
    throw new Error(`Invalid prefix length: "${prefix}". Must be 0-32.`);
  }
  if (prefix === 0) return 0n;
  return (U32 << BigInt(32 - prefix)) & U32;
}

function prefixFromMask(mask) {
  let count = 0;
  let m = BigInt(mask) & U32;
  for (let i = 0; i < 32; i++) {
    if ((m >> BigInt(i)) & 1n) count++;
  }
  return count;
}

function ipClass(ipInt) {
  const first = Number((ipInt >> 24n) & 0xffn);
  if (first < 128) return "A";
  if (first < 192) return "B";
  if (first < 224) return "C";
  if (first < 240) return "D (multicast)";
  return "E (reserved)";
}

function isPrivate(ipInt) {
  const a = Number((ipInt >> 24n) & 0xffn);
  const b = Number((ipInt >> 16n) & 0xffn);
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  return false;
}

export function calculate(ip, prefixInput) {
  const ipInt = ipToInt(ip);
  const prefix = Number(prefixInput);
  const mask = maskFromPrefix(prefix);
  const wildcard = ~mask & U32;
  const network = ipInt & mask;
  const broadcast = network | wildcard;
  const totalAddresses = 2n ** BigInt(32 - prefix);
  const usableHosts = totalAddresses > 2n ? totalAddresses - 2n : 0n;
  const firstUsable = usableHosts > 0n ? network + 1n : null;
  const lastUsable = usableHosts > 0n ? broadcast - 1n : null;

  return {
    input: {
      ip,
      prefix,
      cidr: `${intToIp(ipInt)}/${prefix}`,
    },
    networkAddress: intToIp(network),
    broadcastAddress: intToIp(broadcast),
    netmask: intToIp(mask),
    wildcardMask: intToIp(wildcard),
    firstUsableHost: firstUsable === null ? "N/A" : intToIp(firstUsable),
    lastUsableHost: lastUsable === null ? "N/A" : intToIp(lastUsable),
    usableHostRange: firstUsable === null
      ? "N/A"
      : `${intToIp(firstUsable)} - ${intToIp(lastUsable)}`,
    networkCidr: `${intToIp(network)}/${prefix}`,
    totalAddresses: totalAddresses.toString(),
    usableHosts: usableHosts.toString(),
    ipClass: ipClass(ipInt),
    isPrivate: isPrivate(ipInt),
    ipIsNetworkAddress: ipInt === network,
    ipIsBroadcastAddress: ipInt === broadcast,
  };
}

function requiredPrefix(hosts) {
  const n = Number(hosts);
  if (!Number.isInteger(n) || n < 1) {
    throw new Error(`Invalid host requirement: "${hosts}". Must be a positive integer.`);
  }
  const needed = BigInt(n) + 2n;
  let hostBits = 0n;
  while (2n ** hostBits < needed) hostBits++;
  const prefix = 32 - Number(hostBits);
  if (prefix < 0) {
    throw new Error(`Too many hosts requested: ${n} does not fit in an IPv4 network.`);
  }
  return prefix;
}

export function vlsm(baseCidr, requirements) {
  if (!Array.isArray(requirements) || requirements.length === 0) {
    throw new Error("At least one subnet requirement is required.");
  }

  const [baseIp, basePrefixRaw] = String(baseCidr).split("/");
  const basePrefix = Number(basePrefixRaw);
  const baseMask = maskFromPrefix(basePrefix);
  const baseNetwork = ipToInt(baseIp) & baseMask;
  const baseBroadcast = baseNetwork | (~baseMask & U32);
  const baseSize = baseBroadcast - baseNetwork + 1n;

  const parsed = requirements.map((req, index) => {
    const name = (req.name && String(req.name).trim()) || `Subnet ${index + 1}`;
    const prefix = requiredPrefix(req.hosts);
    const size = 2n ** BigInt(32 - prefix);
    return { name, hosts: Number(req.hosts), prefix, size };
  });

  const ordered = [...parsed].sort((a, b) =>
    a.prefix !== b.prefix ? a.prefix - b.prefix : b.hosts - a.hosts
  );

  let cursor = baseNetwork;
  const allocations = [];
  let used = 0n;

  for (const req of ordered) {
    const network = cursor;
    const broadcast = network + req.size - 1n;
    if (broadcast > baseBroadcast) {
      throw new Error(
        `VLSM failed: not enough space in base network for "${req.name}" (/ ${req.prefix}, ${req.hosts} hosts).`
      );
    }
    const usable = req.size > 2n ? req.size - 2n : 0n;
    const first = usable > 0n ? network + 1n : null;
    const last = usable > 0n ? broadcast - 1n : null;
    allocations.push({
      name: req.name,
      requestedHosts: req.hosts,
      cidr: `${intToIp(network)}/${req.prefix}`,
      networkAddress: intToIp(network),
      broadcastAddress: intToIp(broadcast),
      netmask: intToIp(maskFromPrefix(req.prefix)),
      usableHostRange: first === null ? "N/A" : `${intToIp(first)} - ${intToIp(last)}`,
      usableHosts: usable.toString(),
      allocatedAddresses: req.size.toString(),
    });
    cursor = broadcast + 1n;
    used += req.size;
  }

  return {
    baseCidr: `${intToIp(baseNetwork)}/${basePrefix}`,
    baseNetwork: intToIp(baseNetwork),
    baseBroadcast: intToIp(baseBroadcast),
    totalAddresses: baseSize.toString(),
    allocatedAddresses: used.toString(),
    freeAddresses: (baseSize - used).toString(),
    utilization: `${((Number(used) / Number(baseSize)) * 100).toFixed(1)}%`,
    allocations,
  };
}

export const _internal = { ipToInt, intToIp, maskFromPrefix, prefixFromMask, requiredPrefix };
