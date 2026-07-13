#!/usr/bin/env python3
"""Palkeep single-player save adapter.

This helper is intentionally run as a separate local process. It reads and
writes Palworld saves without sending any save data over the network.
"""

from __future__ import annotations

import contextlib
import copy
import io
import json
import os
import random
import sys
import traceback
import uuid
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE / "vendor"))
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

from palworld_save_tools.gvas import GvasFile
from palworld_save_tools.palsav import compress_gvas_to_sav, decompress_sav_to_gvas
from palworld_save_tools.paltypes import PALWORLD_CUSTOM_PROPERTIES, PALWORLD_TYPE_HINTS


ZERO_GUID = "00000000-0000-0000-0000-000000000000"
CUSTOM_PATHS = {
    ".worldSaveData.CharacterSaveParameterMap.Value.RawData",
    ".worldSaveData.ItemContainerSaveData.Value.Slots.Slots.RawData",
    ".worldSaveData.CharacterContainerSaveData.Value.Slots.Slots.RawData",
    ".worldSaveData.DynamicItemSaveData.DynamicItemSaveData.RawData",
    ".worldSaveData.GroupSaveDataMap.Value.RawData",
}
CUSTOM_PROPERTIES = {
    key: value for key, value in PALWORLD_CUSTOM_PROPERTIES.items() if key in CUSTOM_PATHS
}

# name: (property type, minimum/choices, maximum, game default)
WORLD_SETTING_SCHEMA = {
    "DayTimeSpeedRate": ("float", 0.1, 5.0, 1.0),
    "NightTimeSpeedRate": ("float", 0.1, 5.0, 1.0),
    "ExpRate": ("float", 0.1, 20.0, 1.0),
    "PalCaptureRate": ("float", 0.1, 5.0, 1.0),
    "PalSpawnNumRate": ("float", 0.5, 3.0, 1.0),
    "PlayerDamageRateAttack": ("float", 0.1, 5.0, 1.0),
    "PlayerDamageRateDefense": ("float", 0.1, 5.0, 1.0),
    "PalDamageRateAttack": ("float", 0.1, 5.0, 1.0),
    "PalDamageRateDefense": ("float", 0.1, 5.0, 1.0),
    "PlayerStomachDecreaceRate": ("float", 0.1, 5.0, 1.0),
    "PlayerStaminaDecreaceRate": ("float", 0.1, 5.0, 1.0),
    "PalStomachDecreaceRate": ("float", 0.1, 5.0, 1.0),
    "PalStaminaDecreaceRate": ("float", 0.1, 5.0, 1.0),
    "PlayerAutoHPRegeneRate": ("float", 0.1, 5.0, 1.0),
    "PlayerAutoHpRegeneRateInSleep": ("float", 0.1, 5.0, 1.0),
    "CollectionDropRate": ("float", 0.5, 5.0, 1.0),
    "CollectionObjectHpRate": ("float", 0.5, 5.0, 1.0),
    "CollectionObjectRespawnSpeedRate": ("float", 0.5, 5.0, 1.0),
    "EnemyDropItemRate": ("float", 0.5, 5.0, 1.0),
    "BuildObjectDeteriorationDamageRate": ("float", 0.0, 10.0, 1.0),
    "PalEggDefaultHatchingTime": ("float", 0.0, 72.0, 72.0),
    "ItemWeightRate": ("float", 0.0, 10.0, 1.0),
    "BaseCampWorkerMaxNum": ("int", 1, 100, 15),
    "DropItemMaxNum": ("int", 0, 10000, 3000),
    "bEnableInvaderEnemy": ("bool", None, None, True),
    "bEnableFastTravel": ("bool", None, None, True),
    "bEnableNonLoginPenalty": ("bool", None, None, True),
    "bAutoResetGuildNoOnlinePlayers": ("bool", None, None, False),
    "bIsStartLocationSelectByMap": ("bool", None, None, True),
    "bActiveUNKO": ("bool", None, None, False),
    "DeathPenalty": ("enum", ["None", "Item", "ItemAndEquipment", "All"], None, "All"),
}


def emit(value: dict) -> None:
    print(json.dumps(value, ensure_ascii=False, separators=(",", ":")))


def guid_filename(value: str) -> str:
    return value.replace("-", "").upper() + ".sav"


def default_root() -> Path:
    local = os.environ.get("LOCALAPPDATA")
    if not local:
        raise RuntimeError("LOCALAPPDATA is unavailable on this Windows account.")
    return Path(local) / "Pal" / "Saved" / "SaveGames"


def validate_world(value: str) -> Path:
    world = Path(value).resolve()
    if not (world / "Level.sav").is_file():
        raise ValueError("The selected folder does not contain Level.sav.")
    return world


def save_format(level: Path) -> str:
    data = level.read_bytes()[:12]
    if len(data) < 12:
        return "Unknown"
    magic = data[8:11].decode("ascii", errors="replace")
    return {"PlM": "PlM / Oodle", "PlZ": "PlZ / zlib", "CNK": "CNK / Xbox"}.get(magic, magic)


def discover(root_value: str | None = None) -> dict:
    root = Path(root_value).resolve() if root_value else default_root()
    worlds = []
    if root.is_dir():
        for level in root.glob("*/*/Level.sav"):
            stat = level.stat()
            players = level.parent / "Players"
            player_count = len([p for p in players.glob("*.sav") if not p.stem.endswith("_dps")]) if players.is_dir() else 0
            worlds.append({
                "id": level.parent.name,
                "label": f"World {level.parent.name[-8:]}",
                "path": str(level.parent),
                "modifiedAt": datetime.fromtimestamp(stat.st_mtime, timezone.utc).isoformat(),
                "size": stat.st_size,
                "format": save_format(level),
                "playerCount": player_count,
            })
    worlds.sort(key=lambda world: world["modifiedAt"], reverse=True)
    return {"root": str(root), "worlds": worlds}


def load_sav(path: Path, custom: dict | None = None):
    with contextlib.redirect_stdout(io.StringIO()):
        raw, save_type = decompress_sav_to_gvas(path.read_bytes())
        gvas = GvasFile.read(raw, PALWORLD_TYPE_HINTS, custom or {})
    return gvas, save_type


def world_data(gvas: GvasFile) -> dict:
    return gvas.dump()["properties"]["worldSaveData"]["value"]


def world_option_settings(world: Path) -> tuple[GvasFile | None, int | None, dict]:
    option_path = world / "WorldOption.sav"
    if not option_path.is_file():
        return None, None, {}
    gvas, save_type = load_sav(option_path)
    settings = gvas.dump().get("properties", {}).get("OptionWorldData", {}).get("value", {}).get("Settings", {}).get("value", {})
    return gvas, save_type, settings


def flatten_world_settings(settings: dict) -> dict:
    result = {}
    for name, (kind, _minimum, _maximum, default) in WORLD_SETTING_SCHEMA.items():
        prop = settings.get(name)
        if not prop:
            result[name] = default
            continue
        value = prop.get("value", default)
        if kind == "enum" and isinstance(value, dict):
            value = str(value.get("value", default)).split("::")[-1]
        result[name] = value
    return result


def player_save(world: Path, player_uid: str) -> tuple[Path, dict]:
    path = world / "Players" / guid_filename(player_uid)
    if not path.is_file():
        candidates = [p for p in (world / "Players").glob("*.sav") if not p.stem.endswith("_dps")]
        if len(candidates) == 1:
            path = candidates[0]
        else:
            raise FileNotFoundError(f"Player save not found for {player_uid}.")
    gvas, _ = load_sav(path)
    return path, gvas.dump()["properties"]["SaveData"]["value"]


def nested_level(save_parameter: dict) -> int:
    value = save_parameter.get("Level", {}).get("value", 1)
    return int(value.get("value", 1) if isinstance(value, dict) else value)


def player_records(data: dict) -> list[dict]:
    records = []
    for entry in data["CharacterSaveParameterMap"]["value"]:
        raw = entry.get("value", {}).get("RawData", {}).get("value", {})
        parameter = raw.get("object", {}).get("SaveParameter", {}).get("value", {})
        if not parameter.get("IsPlayer", {}).get("value"):
            continue
        records.append({
            "entry": entry,
            "uid": str(entry["key"]["PlayerUId"]["value"]),
            "name": parameter.get("NickName", {}).get("value") or "Player",
            "level": nested_level(parameter),
            "groupId": str(raw.get("group_id", ZERO_GUID)),
        })
    return records


def container_guid(value: dict, key: str) -> str:
    return str(value[key]["value"]["ID"]["value"])


def slot_payload(slot: dict) -> dict | None:
    return slot.get("RawData", {}).get("value")


def container_for(data: dict, container_id: str, kind: str) -> dict:
    for entry in data[kind]["value"]:
        if str(entry.get("key", {}).get("ID", {}).get("value")) == container_id:
            return entry
    raise ValueError(f"Save container {container_id} is missing.")


def inspect_world(world_value: str) -> dict:
    world = validate_world(world_value)
    gvas, _ = load_sav(world / "Level.sav", CUSTOM_PROPERTIES)
    data = world_data(gvas)
    output_players = []
    for player in player_records(data):
        try:
            player_path, profile = player_save(world, player["uid"])
            inventory_id = container_guid(profile["InventoryInfo"]["value"], "CommonContainerId")
            pal_storage_id = container_guid(profile, "PalStorageContainerId")
            party_id = container_guid(profile, "OtomoCharacterContainerId")
            container = container_for(data, inventory_id, "ItemContainerSaveData")
            items = []
            for slot in container["value"]["Slots"]["value"]["values"]:
                payload = slot_payload(slot)
                if not payload or not payload.get("item", {}).get("static_id"):
                    continue
                items.append({
                    "itemId": str(payload["item"]["static_id"]),
                    "quantity": int(payload.get("count", 0)),
                    "slot": int(payload.get("slot_index", 0)),
                })
            pals = []
            for entry in data["CharacterSaveParameterMap"]["value"]:
                raw = entry.get("value", {}).get("RawData", {}).get("value", {})
                parameter = raw.get("object", {}).get("SaveParameter", {}).get("value", {})
                if str(parameter.get("OwnerPlayerUId", {}).get("value")) != player["uid"]:
                    continue
                slot_id = parameter.get("SlotId", {}).get("value", {})
                pal_container = str(slot_id.get("ContainerId", {}).get("value", {}).get("ID", {}).get("value"))
                if pal_container not in {pal_storage_id, party_id}:
                    continue
                pals.append({
                    "speciesId": str(parameter.get("CharacterID", {}).get("value", "Unknown")),
                    "name": str(parameter.get("NickName", {}).get("value") or parameter.get("CharacterID", {}).get("value", "Unknown")),
                    "level": nested_level(parameter),
                    "passives": [str(value) for value in parameter.get("PassiveSkillList", {}).get("value", {}).get("values", [])],
                    "gender": str(parameter.get("Gender", {}).get("value", {}).get("value", "")).replace("EPalGenderType::", ""),
                    "instanceId": str(entry["key"]["InstanceId"]["value"]),
                    "location": "Party" if pal_container == party_id else "Palbox",
                    "slot": int(slot_id.get("SlotIndex", {}).get("value", 0)),
                })
            output_players.append({
                "playerId": player["uid"],
                "name": player["name"],
                "level": player["level"],
                "playerFile": player_path.name,
                "inventory": sorted(items, key=lambda item: item["slot"]),
                "pals": sorted(pals, key=lambda pal: (pal["location"], pal["slot"])),
            })
        except Exception as error:
            output_players.append({**{key: player[key] for key in ("uid", "name", "level")}, "error": str(error)})
    _option_gvas, _option_type, option_settings = world_option_settings(world)
    stat = (world / "Level.sav").stat()
    return {
        "world": {
            "id": world.name,
            "label": f"World {world.name[-8:]}",
            "path": str(world),
            "modifiedAt": datetime.fromtimestamp(stat.st_mtime, timezone.utc).isoformat(),
            "format": save_format(world / "Level.sav"),
        },
        "players": output_players,
        "settings": flatten_world_settings(option_settings),
        "hasWorldOptions": bool(option_settings),
    }


def find_player(data: dict, uid: str | None) -> dict:
    players = player_records(data)
    if not players:
        raise ValueError("No editable player was found in this world.")
    if uid:
        for player in players:
            if player["uid"] == uid:
                return player
        raise ValueError("The selected player no longer exists in this save.")
    return players[0]


def first_free(values: list[int], maximum: int) -> int:
    occupied = set(values)
    for value in range(maximum):
        if value not in occupied:
            return value
    raise ValueError("The destination container is full.")


def validate_item_slots(container: dict) -> tuple[list[dict], int, list[int]]:
    """Return a container's slots, declared capacity, and occupied indices.

    Palworld stores sparse slot arrays: the number of serialized entries can be
    smaller than SlotNum.  SlotNum is the authoritative capacity and valid
    indices are 0..SlotNum-1.
    """
    value = container.get("value", {})
    slots = value.get("Slots", {}).get("value", {}).get("values", [])
    capacity = int(value.get("SlotNum", {}).get("value", 0))
    if capacity < 1:
        raise ValueError("The inventory has an invalid slot capacity. Restore a backup before editing it.")

    occupied: list[int] = []
    for slot in slots:
        payload = slot_payload(slot)
        if not payload:
            continue
        slot_index = int(payload.get("slot_index", -1))
        if slot_index < 0 or slot_index >= capacity:
            raise ValueError(
                f"Unsafe inventory slot {slot_index} detected; valid slots are 0-{capacity - 1}. "
                "Restore the automatic backup made before the item change."
            )
        if slot_index in occupied:
            raise ValueError(
                f"Duplicate inventory slot {slot_index} detected. Restore a backup before editing this inventory."
            )
        occupied.append(slot_index)
    return slots, capacity, occupied


def write_level(world: Path, gvas: GvasFile, save_type: int) -> None:
    level = world / "Level.sav"
    temp = world / "Level.sav.palkeep.tmp"
    with contextlib.redirect_stdout(io.StringIO()):
        raw = gvas.write(PALWORLD_CUSTOM_PROPERTIES)
        encoded = compress_gvas_to_sav(raw, save_type)
    temp.write_bytes(encoded)
    try:
        # Refuse to replace the real save unless the complete result parses again.
        load_sav(temp, CUSTOM_PROPERTIES)
        os.replace(temp, level)
    finally:
        if temp.exists():
            temp.unlink()


def give_item(world_value: str, player_uid: str | None, item_id: str, quantity: int, mode: str = "add") -> dict:
    if not item_id or len(item_id) > 128:
        raise ValueError("Choose a valid item ID.")
    if quantity < 1 or quantity > 9999999:
        raise ValueError("Quantity must be between 1 and 9,999,999.")
    world = validate_world(world_value)
    gvas, save_type = load_sav(world / "Level.sav", CUSTOM_PROPERTIES)
    data = world_data(gvas)
    player = find_player(data, player_uid)
    _, profile = player_save(world, player["uid"])
    inventory_id = container_guid(profile["InventoryInfo"]["value"], "CommonContainerId")
    container = container_for(data, inventory_id, "ItemContainerSaveData")
    slots, capacity, occupied = validate_item_slots(container)
    target = None
    for slot in slots:
        payload = slot_payload(slot)
        if payload and payload.get("item", {}).get("static_id") == item_id:
            target = payload
            break
    if target:
        target["count"] = quantity if mode == "set" else int(target.get("count", 0)) + quantity
        slot_index = int(target.get("slot_index", 0))
    else:
        template = next((slot for slot in slots if slot_payload(slot)), None)
        if not template:
            raise ValueError("The inventory has no slot template that can be safely cloned.")
        # Never infer capacity from the serialized list length. Palworld permits
        # sparse arrays, but it crashes if an index is equal to SlotNum.
        slot_index = first_free(occupied, capacity)
        clone = copy.deepcopy(template)
        payload = slot_payload(clone)
        payload["slot_index"] = slot_index
        payload["count"] = quantity
        payload["item"]["static_id"] = item_id
        payload["item"]["dynamic_id"] = {"created_world_id": ZERO_GUID, "local_id_in_created_world": ZERO_GUID}
        slots.append(clone)
    write_level(world, gvas, save_type)
    return {"ok": True, "action": "giveItem", "playerId": player["uid"], "itemId": item_id, "quantity": quantity, "mode": mode, "slot": slot_index}


def update_world_settings(world_value: str, changes: dict) -> dict:
    world = validate_world(world_value)
    gvas, save_type, settings = world_option_settings(world)
    if gvas is None or save_type is None:
        raise ValueError("WorldOption.sav is missing. Open World Settings in Palworld once, save, and try again.")
    if not isinstance(changes, dict) or not changes:
        raise ValueError("Choose at least one world setting to update.")

    applied = {}
    for name, requested in changes.items():
        if name not in WORLD_SETTING_SCHEMA:
            raise ValueError(f"Unsupported world setting: {name}")
        kind, minimum, maximum, default = WORLD_SETTING_SCHEMA[name]
        if kind == "bool":
            if not isinstance(requested, bool):
                raise ValueError(f"{name} must be true or false.")
            value = requested
            prop = settings.setdefault(name, {"value": default, "id": None, "type": "BoolProperty"})
            prop["value"] = value
        elif kind in {"float", "int"}:
            try:
                value = float(requested) if kind == "float" else int(requested)
            except (TypeError, ValueError):
                raise ValueError(f"{name} must be a number.") from None
            if value < minimum or value > maximum:
                raise ValueError(f"{name} must be between {minimum} and {maximum}.")
            prop_type = "FloatProperty" if kind == "float" else "IntProperty"
            prop = settings.setdefault(name, {"id": None, "value": default, "type": prop_type})
            prop["value"] = value
        else:
            value = str(requested)
            if value not in minimum:
                raise ValueError(f"{name} has an unsupported value.")
            enum_type = "EPalOptionWorldDeathPenalty"
            prop = settings.setdefault(name, {"id": None, "value": {"type": enum_type, "value": f"{enum_type}::{default}"}, "type": "EnumProperty"})
            prop["value"] = {"type": enum_type, "value": f"{enum_type}::{value}"}
        applied[name] = value

    difficulty = settings.get("Difficulty")
    if difficulty:
        difficulty["value"] = {"type": "EPalOptionWorldDifficulty", "value": "EPalOptionWorldDifficulty::Custom"}

    option_path = world / "WorldOption.sav"
    temporary = world / "WorldOption.sav.palkeep.tmp"
    with contextlib.redirect_stdout(io.StringIO()):
        raw = gvas.write(PALWORLD_CUSTOM_PROPERTIES)
        encoded = compress_gvas_to_sav(raw, save_type)
    temporary.write_bytes(encoded)
    try:
        verified, _ = load_sav(temporary)
        verified_settings = verified.dump().get("properties", {}).get("OptionWorldData", {}).get("value", {}).get("Settings", {}).get("value", {})
        flattened = flatten_world_settings(verified_settings)
        for name, value in applied.items():
            actual = flattened.get(name)
            matches = abs(float(actual) - float(value)) < 0.0001 if isinstance(value, float) else actual == value
            if not matches:
                raise ValueError(f"World setting validation failed for {name}.")
        os.replace(temporary, option_path)
    finally:
        if temporary.exists():
            temporary.unlink()
    return {"ok": True, "action": "updateSettings", "settings": applied}


def add_pal(world_value: str, player_uid: str | None, species_id: str, display_name: str, level: int, gender: str, passives: list[str], rank: int, talent_hp: int, talent_attack: int, talent_defense: int) -> dict:
    if not species_id or len(species_id) > 128:
        raise ValueError("Choose a valid Pal species ID.")
    if level < 1 or level > 100:
        raise ValueError("Pal level must be between 1 and 100.")
    if gender not in {"Random", "Male", "Female"}:
        raise ValueError("Pal gender must be Random, Male, or Female.")
    if rank < 1 or rank > 5:
        raise ValueError("Pal condensation rank must be between 1 and 5.")
    if any(value < 0 or value > 100 for value in (talent_hp, talent_attack, talent_defense)):
        raise ValueError("Pal talents must be between 0 and 100.")
    passives = [str(value) for value in passives if value][:4]
    world = validate_world(world_value)
    gvas, save_type = load_sav(world / "Level.sav", CUSTOM_PROPERTIES)
    data = world_data(gvas)
    player = find_player(data, player_uid)
    _, profile = player_save(world, player["uid"])
    storage_id = container_guid(profile, "PalStorageContainerId")
    characters = data["CharacterSaveParameterMap"]["value"]
    owned = []
    for entry in characters:
        parameter = entry.get("value", {}).get("RawData", {}).get("value", {}).get("object", {}).get("SaveParameter", {}).get("value", {})
        if str(parameter.get("OwnerPlayerUId", {}).get("value")) == player["uid"] and parameter.get("CharacterID", {}).get("value"):
            owned.append((entry, parameter))
    if not owned:
        raise ValueError("No existing owned Pal is available as a safe save template.")
    template, _ = next(((entry, parameter) for entry, parameter in owned if parameter.get("CharacterID", {}).get("value") == species_id), owned[0])
    clone = copy.deepcopy(template)
    raw = clone["value"]["RawData"]["value"]
    parameter = raw["object"]["SaveParameter"]["value"]
    instance_id = str(uuid.uuid4())
    container = container_for(data, storage_id, "CharacterContainerSaveData")
    container_slots = container["value"]["Slots"]["value"]["values"]
    slot_index = first_free([int(slot["SlotIndex"]["value"]) for slot in container_slots], 960)
    clone["key"]["PlayerUId"]["value"] = player["uid"]
    clone["key"]["InstanceId"]["value"] = instance_id
    if "DebugName" in clone["key"]:
        clone["key"]["DebugName"]["value"] = display_name or species_id
    raw["group_id"] = player["groupId"]
    parameter["CharacterID"]["value"] = species_id
    if "NickName" in parameter:
        parameter["NickName"]["value"] = display_name or species_id
    if "FilteredNickName" in parameter:
        parameter["FilteredNickName"]["value"] = display_name or species_id
    level_value = parameter["Level"]["value"]
    if isinstance(level_value, dict):
        level_value["value"] = level
    else:
        parameter["Level"]["value"] = level
    if "Exp" in parameter:
        parameter["Exp"]["value"] = 0
    chosen_gender = random.choice(["Male", "Female"]) if gender == "Random" else gender
    if "Gender" in parameter:
        gender_value = parameter["Gender"]["value"]
        if isinstance(gender_value, dict):
            gender_value["value"] = f"EPalGenderType::{chosen_gender}"
        else:
            parameter["Gender"]["value"] = f"EPalGenderType::{chosen_gender}"
    for key, value in (("Rank", rank), ("Talent_HP", talent_hp), ("Talent_Shot", talent_attack), ("Talent_Defense", talent_defense)):
        if key in parameter:
            current = parameter[key]["value"]
            if isinstance(current, dict):
                current["value"] = value
            else:
                parameter[key]["value"] = value
    parameter["OwnerPlayerUId"]["value"] = player["uid"]
    if "OldOwnerPlayerUIds" in parameter:
        parameter["OldOwnerPlayerUIds"]["value"]["values"] = [player["uid"]]
    slot = parameter["SlotId"]["value"]
    slot["ContainerId"]["value"]["ID"]["value"] = storage_id
    slot["SlotIndex"]["value"] = slot_index
    if "PassiveSkillList" in parameter:
        parameter["PassiveSkillList"]["value"]["values"] = passives
    characters.append(clone)
    if not container_slots:
        raise ValueError("The Palbox has no slot template that can be safely cloned.")
    container_clone = copy.deepcopy(container_slots[-1])
    container_clone["SlotIndex"]["value"] = slot_index
    container_clone["RawData"]["value"]["instance_id"] = instance_id
    container_slots.append(container_clone)
    for group in data.get("GroupSaveDataMap", {}).get("value", []):
        group_raw = group.get("value", {}).get("RawData", {}).get("value", {})
        if str(group.get("key")) == player["groupId"] or str(group_raw.get("admin_player_uid")) == player["uid"] or any(str(member.get("player_uid")) == player["uid"] for member in group_raw.get("players", [])):
            handles = group_raw.setdefault("individual_character_handle_ids", [])
            handles.append({"guid": "00000000-0000-0000-0000-000000000001", "instance_id": instance_id})
            break
    write_level(world, gvas, save_type)
    return {"ok": True, "action": "addPal", "playerId": player["uid"], "speciesId": species_id, "level": level, "gender": chosen_gender, "passives": passives, "rank": rank, "talents": {"hp": talent_hp, "attack": talent_attack, "defense": talent_defense}, "slot": slot_index, "instanceId": instance_id}


def main() -> None:
    request = json.load(sys.stdin)
    action = request.get("action")
    if action == "discover":
        emit(discover(request.get("root")))
    elif action == "inspect":
        emit(inspect_world(request["worldPath"]))
    elif action == "giveItem":
        emit(give_item(request["worldPath"], request.get("playerId"), str(request.get("itemId", "")), int(request.get("quantity", 0)), request.get("mode", "add")))
    elif action == "addPal":
        emit(add_pal(request["worldPath"], request.get("playerId"), str(request.get("speciesId", "")), str(request.get("displayName", "")), int(request.get("level", 1)), str(request.get("gender", "Random")), request.get("passives", []), int(request.get("rank", 1)), int(request.get("talentHp", 50)), int(request.get("talentAttack", 50)), int(request.get("talentDefense", 50))))
    elif action == "updateSettings":
        emit(update_world_settings(request["worldPath"], request.get("settings", {})))
    else:
        raise ValueError("Unsupported single-player action.")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(traceback.format_exc(), file=sys.stderr)
        emit({"ok": False, "error": str(error)})
        raise SystemExit(1)
