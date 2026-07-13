-- Palkeep Live Bridge v0.2.0
-- Game-thread item delivery with file-based IPC on the local machine.
-- Direct inventory call based on fol2/palworld-server-toolkit LiveEditor
-- (GPL-3.0); see the bundled license and THIRD_PARTY_NOTICES.txt.

local MOD_NAME = "PalkeepLive"
local MOD_VERSION = "0.2.0"
local appData = os.getenv("APPDATA")
if not appData then
    print("[PalkeepLive] APPDATA is unavailable; bridge disabled.\n")
    return
end

local ipcDir = appData .. "\\Palkeep Server Command\\live-bridge"
local commandFile = ipcDir .. "\\commands.json"
local responseFile = ipcDir .. "\\responses.json"
local jsonOk, json = pcall(function() return require("Json") end)
if not jsonOk then
    print("[PalkeepLive] Json.lua could not be loaded; bridge disabled.\n")
    return
end

local function log(message)
    print(string.format("[%s] %s\n", MOD_NAME, tostring(message)))
end

local function readFile(file)
    local handle = io.open(file, "r")
    if not handle then return nil end
    local content = handle:read("*a")
    handle:close()
    if not content or content == "" then return nil end
    return content
end

local function writeResponse(id, success, message, data)
    local temporary = responseFile .. ".tmp"
    local handle = io.open(temporary, "w")
    if not handle then
        log("Could not write bridge response")
        return
    end
    handle:write(json.encode({
        id = id,
        success = success,
        message = tostring(message or ""),
        data = data or {}
    }))
    handle:close()
    os.remove(responseFile)
    os.rename(temporary, responseFile)
end

local function playerName(playerState)
    local name = ""
    pcall(function()
        if playerState.PlayerNamePrivate then
            name = playerState.PlayerNamePrivate:ToString()
        end
    end)
    if name == "" then
        pcall(function() name = playerState.SavedPlayerName:ToString() end)
    end
    return name
end

local function allPlayers()
    local result = {}
    local states = FindAllOf("PalPlayerState")
    if not states then return result end
    for _, state in ipairs(states) do
        local valid = false
        pcall(function() valid = state:IsValid() end)
        if valid then
            local name = playerName(state)
            if name ~= "" then table.insert(result, { name = name, state = state }) end
        end
    end
    return result
end

local function findPlayer(wanted)
    local players = allPlayers()
    if not wanted or wanted == "" then return players[1] end
    local needle = string.lower(wanted)
    for _, player in ipairs(players) do
        if string.lower(player.name) == needle then return player end
    end
    return nil
end

local function health(id)
    local names = {}
    for _, player in ipairs(allPlayers()) do table.insert(names, player.name) end
    writeResponse(id, true, "Palkeep live bridge ready", {
        version = MOD_VERSION,
        gameConnected = true,
        players = names
    })
end

-- Palworld 1.0 added bNotifyLog to AddItem_ServerInternal. Try the current
-- five-input signature first so the player gets the native acquisition log,
-- then fall back for older game builds that still expose four inputs.
local function addItemServerInternal(inventory, itemId, quantity)
    local currentOk, currentResult = pcall(function()
        return inventory:AddItem_ServerInternal(FName(itemId), quantity, false, 0.0, true)
    end)
    if currentOk then return true, currentResult, "palworld-1.0" end

    local legacyOk, legacyResult = pcall(function()
        return inventory:AddItem_ServerInternal(FName(itemId), quantity, false, 0.0)
    end)
    if legacyOk then return true, legacyResult, "legacy" end

    return false,
        "current signature: " .. tostring(currentResult) ..
        "; legacy signature: " .. tostring(legacyResult),
        "unsupported"
end

local function giveItem(id, params)
    local itemId = tostring(params.item_id or "")
    local quantity = math.floor(tonumber(params.quantity) or 0)
    if itemId == "" or not string.match(itemId, "^[%w_]+$") then
        writeResponse(id, false, "Invalid item ID")
        return
    end
    if quantity < 1 or quantity > 9999 then
        writeResponse(id, false, "Quantity must be between 1 and 9,999")
        return
    end

    local player = findPlayer(tostring(params.target_player or ""))
    if not player then
        writeResponse(id, false, "The selected player is not loaded in the world")
        return
    end

    local inventoryOk, inventory = pcall(function()
        return player.state:GetInventoryData()
    end)
    if not inventoryOk or not inventory then
        writeResponse(id, false, "The running game did not expose the player's inventory")
        return
    end

    local scheduled, scheduleError = pcall(function()
        ExecuteInGameThread(function()
            local callOk, result, signature = addItemServerInternal(inventory, itemId, quantity)
            if callOk then
                writeResponse(id, true,
                    string.format("Delivered %d x %s to %s", quantity, itemId, player.name),
                    { itemId = itemId, quantity = quantity, player = player.name,
                      destination = "inventory", gameResult = tostring(result),
                      signature = signature })
            else
                writeResponse(id, false, "Palworld rejected the live item delivery: " .. tostring(result))
            end
        end)
    end)
    if not scheduled then
        writeResponse(id, false, "Could not schedule the game operation: " .. tostring(scheduleError))
    end
end

local busy = false
LoopAsync(350, function()
    if busy then return false end
    local content = readFile(commandFile)
    if not content then return false end
    busy = true
    os.remove(commandFile)
    local decodedOk, command = pcall(function() return json.decode(content) end)
    if not decodedOk or type(command) ~= "table" then
        writeResponse("unknown", false, "Invalid bridge command")
        busy = false
        return false
    end
    local id = tostring(command.id or "unknown")
    if command.type == "health" then
        health(id)
    elseif command.type == "give_item" then
        giveItem(id, command.params or {})
    else
        writeResponse(id, false, "Unsupported live operation")
    end
    busy = false
    return false
end)

log("v" .. MOD_VERSION .. " loaded; waiting for Palkeep commands")
