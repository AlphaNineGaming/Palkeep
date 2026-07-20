# Palkeep live bridge contract (v1)

Palkeep uses Pocketpair's official REST API for server information, players,
metrics, settings, saves, announcements, kicks, and bans. The official API does
not expose player inventory, Palbox contents, item grants, Pal creation,
teleports, or private messages. A server-side mod can expose the small bridge
contract below to unlock those actions.

The desktop app defaults to `http://127.0.0.1:8213/v1` and sends the configured
token as `Authorization: Bearer <token>`. Bind the bridge to loopback or a
private LAN interface only. Return JSON and use non-2xx responses with a JSON
`message` or `error` field when an operation fails.

## Health and reads

- `GET /v1/health` → `{ "ok": true, "version": "1.0.0", "gameConnected": true }`
- `GET /v1/players/:playerId/inventory` → `{ "items": [{ "itemId": "LegendarySphere", "name": "Legendary Sphere", "quantity": 20, "capacity": 99 }] }`
- `GET /v1/players/:playerId/pals` → `{ "pals": [{ "instanceId": "...", "speciesId": "Anubis", "name": "Anubis", "level": 50, "passive": "Legend", "element": "Ground" }] }`

## Mutations

- `POST /v1/players/:playerId/items` with `{ "itemId", "quantity", "destination" }`
- `POST /v1/players/:playerId/pals` with `{ "speciesId", "displayName", "gender", "level", "passive", "passives", "rank", "talentHp", "talentAttack", "talentDefense", "bossVariant" }`. `bossVariant` requests the species' `BOSS_`/Alpha companion form. `passive` mirrors the first entry in `passives` for compatibility with older bridge builds.

The bundled single-player live bridge also accepts the local IPC operation
`set_base_range` with `{ "radius_cm": 3500..10000 }`. It updates the functional
range of every loaded base, attempts to scale the Palbox boundary, and persists
the selection so it can be reapplied on world load. Palworld 1.0 may retain the
vanilla blue line even when the functional radius is larger.
- `POST /v1/players/:playerId/teleport` with `{ "mode": "to-admin" }`
- `POST /v1/players/:playerId/message` with `{ "message" }`

Each successful mutation should return `{ "ok": true }` plus any updated
object. The desktop app requests the official `/save` endpoint before bridge
mutations when **Save before mutations** is enabled.
