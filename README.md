# cidr-calculator

A simple webapp for IPv4 CIDR/subnet calculations. Enter an IP + prefix to get the
network and broadcast address, usable host range, netmask/wildcard, and a VLSM
breakdown for planning subnets.

## Features

- Network address, broadcast address, usable host range
- Netmask, wildcard mask, total/usable host counts
- IP class and private-range detection
- VLSM planner: largest-first allocation with utilization summary
- Express API + vanilla HTML/CSS/JS frontend

## Getting started

```bash
npm install
npm start
```

Then open http://localhost:3000.

## Scripts

| Command       | Description                     |
| ------------- | ------------------------------- |
| `npm start`   | Run the webapp                  |
| `npm run dev` | Run with auto-restart on change |
| `npm test`    | Run the test suite              |

## API

- `GET /api/health`
- `GET /api/calculate?ip=192.168.1.10&prefix=24`
- `POST /api/vlsm` with `{ "baseCidr": "192.168.1.0/24", "requirements": [{ "name": "Sales", "hosts": 50 }] }`

## License

MIT
