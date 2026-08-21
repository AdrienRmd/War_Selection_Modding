local TEST_MODE = false 
local MAX_ALLIES = 5   

currentRQ = 0; currentP1 = -1; currentP2 = -1; currentAction = -1; currentWork = 0; hideShow = false
local hasInitButtonAlign  = false

function getNodes() 
    return root.interface[root.interface.f_getIndex("diplomacyInterface")].nodes 
end

function getPlayerName(playerId)
    local storage = root.session_visual.dataStorage
    local names = fromJson(storage.playerNames)
    return names[playerId + 1]
end

function checkStatusFrontend(fa, fb)
    local status = 0
    pcall(function() status = root.session_gameplay_gameplay_scene_0.relation.f_get(fa, fb) end)
    if status == 1 then return "Ally" elseif status == 2 then return "War" elseif status == 3 then return "Peace" end
    return "Neutral"
end

function getAllyCount(factionId)
    local total = 0
    for fac = 0, root.session_gameplay_gameplay_faction.size - 1 do
        if fac ~= factionId then
            if checkStatusFrontend(factionId, fac) == "Ally" then total = total + 1 end
        end
    end
    return total
end

-- ============================================================================
-- Gestionnaire de messages indépendant à trois couches
-- ============================================================================
GlobalNotif  = { active = false, msg = "", expire = 0 }
RequestNotif = { active = false, player = -1, msg = "", expire = 0 }
SystemNotif  = { active = false, player = -1, msg = "", expire = 0 } 

-- Envoi d'une annonce globale (dorée)
function SendGlobalMsg(msg)
    GlobalNotif.active = true; GlobalNotif.msg = msg; GlobalNotif.expire = root.session_gameplay_gameplay_time + 8000
end

-- Envoi d'un message système (couleur d'origine)
function SendSystemMsg(player, msg)
    SystemNotif.active = true; SystemNotif.player = player; SystemNotif.msg = msg; SystemNotif.expire = root.session_gameplay_gameplay_time + 5000
end

-- Envoi d'une requête d'interaction (bleue)
function SendRequestMsg(player, msg)
    RequestNotif.active = true; RequestNotif.player = player; RequestNotif.msg = msg; RequestNotif.expire = root.session_gameplay_gameplay_time + 10000
end

-- ============================================================================
-- Moteur de rendu périodique (réquisitionne trois boutons natifs inutilisés, pour un affichage simultané parfait à l'écran)
-- ============================================================================
function updateGamePlay(var, currentMoment)
    if currentMoment == 1000 then SetMusicOnStart() end
    if currentMoment == 3000 then DiplomacyInterface:playSound(openingSound, 1) end

    if currentMoment % 10 == 0 then
        local width = root.window.width; local height = root.window.height
        local nodes = getNodes()
        if not nodes then return end
        
        local myPlayer = getPlayerOfFaction(root.session.visual.currentFaction)
        local curTime = root.session_gameplay_gameplay_time

        -- --------------------------------------------------------------------
        -- 1. Piste supérieure : annonce globale (réquisitionne le nœud inutilisé 21 comme fond, 28 comme texte)
        -- --------------------------------------------------------------------
        if GlobalNotif.active then
            if curTime > GlobalNotif.expire then 
                GlobalNotif.active = false
                nodes[21].visible = false; nodes[28].visible = false
            else
                nodes[21].visible = true; nodes[21].sizeX = 1200; nodes[21].sizeY = 50
                nodes[21].localLeft = width // 2 - 600; nodes[21].localTop = height // 2 - 400
                pcall(function() nodes[21].color.r = 255; nodes[21].color.g = 215; nodes[21].color.b = 0; nodes[21].color.a = 200 end)
                nodes[21].eventTransparent = true; nodes[21].disabled = true; nodes[21].eventStopper = false
                
                nodes[28].visible = true; nodes[28].disabled = false; nodes[28].sizeX = 1200; nodes[28].sizeY = 50
                nodes[28].localLeft = 0; nodes[28].localTop = 0
                pcall(function() nodes[28].widget.font = "SIMHEI" end)
                pcall(function() nodes[28].widget.font.size = 28 end)
                pcall(function() nodes[28].widget.fontSize = 28 end)
                pcall(function() nodes[28].widget_text = GlobalNotif.msg end)
            end
        else
            nodes[21].visible = false; nodes[28].visible = false
        end

        -- --------------------------------------------------------------------
        -- 2. Piste intermédiaire : message système (conserve le design de l'auteur original, utilise les nœuds 17 et 8)
        -- --------------------------------------------------------------------
        if SystemNotif.active and SystemNotif.player == myPlayer then
            if curTime > SystemNotif.expire then 
                SystemNotif.active = false
                nodes[17].visible = false; nodes[8].visible = false
            else
                nodes[17].visible = true; nodes[17].sizeX = 1200; nodes[17].sizeY = 50
                nodes[17].localLeft = width // 2 - 600; nodes[17].localTop = height // 2 - 300
                pcall(function() nodes[17].color.r = 221; nodes[17].color.g = 217; nodes[17].color.b = 179; nodes[17].color.a = 150 end)
                nodes[17].eventTransparent = true; nodes[17].disabled = true; nodes[17].eventStopper = false
                
                nodes[8].visible = true; nodes[8].disabled = false; nodes[8].sizeX = 1200; nodes[8].sizeY = 50
                nodes[8].localLeft = 0; nodes[8].localTop = 0
                pcall(function() nodes[8].widget.font = "SIMHEI" end)
                pcall(function() nodes[8].widget.font.size = 28 end)
                pcall(function() nodes[8].widget.fontSize = 28 end)
                pcall(function() nodes[8].widget_text = SystemNotif.msg end)
            end
        else
            nodes[17].visible = false; nodes[8].visible = false
        end

        -- --------------------------------------------------------------------
        -- 3. Piste inférieure : requête d'interaction (réquisitionne le nœud inutilisé 22 comme fond, 29 comme texte)
        -- --------------------------------------------------------------------
        if RequestNotif.active and RequestNotif.player == myPlayer then
            if curTime > RequestNotif.expire then 
                RequestNotif.active = false
                nodes[22].visible = false; nodes[29].visible = false
            else
                nodes[22].visible = true; nodes[22].sizeX = 1200; nodes[22].sizeY = 50
                nodes[22].localLeft = width // 2 - 600; nodes[22].localTop = height // 2 - 200
                pcall(function() nodes[22].color.r = 100; nodes[22].color.g = 200; nodes[22].color.b = 255; nodes[22].color.a = 180 end)
                nodes[22].eventTransparent = true; nodes[22].disabled = true; nodes[22].eventStopper = false
                
                nodes[29].visible = true; nodes[29].disabled = false; nodes[29].sizeX = 1200; nodes[29].sizeY = 50
                nodes[29].localLeft = 0; nodes[29].localTop = 0
                pcall(function() nodes[29].widget.font = "SIMHEI" end)
                pcall(function() nodes[29].widget.font.size = 28 end)
                pcall(function() nodes[29].widget.fontSize = 28 end)
                pcall(function() nodes[29].widget_text = RequestNotif.msg end)
            end
        else
            nodes[22].visible = false; nodes[29].visible = false
        end

        -- ====================================================================
        -- Ci-dessous : logique de disposition native du menu de boutons
        -- ====================================================================
        local buttons = { 18, 12, 13, 14, 15, 16 }; local texts = { 9, 3, 4, 5, 6, 7 }
        local names = { "X", "Alliance", "Paix", "Guerre", "Accepter", "Refuser" }

        nodes[1].localLeft = 0; nodes[1].localTop = 0; nodes[1].sizeX = width; nodes[1].sizeY = height
        nodes[1].horizontalAlign = 3; nodes[1].verticalAlign = 1     

        if nodes[19] then pcall(function() nodes[19].color.a = 100 end) end
        
        nodes[12].color.r = 13; nodes[12].color.g = 255; nodes[12].color.b = 0; nodes[12].color.a = 255
        nodes[13].color.r = 255; nodes[13].color.g = 161; nodes[13].color.b = 0; nodes[13].color.a = 255
        nodes[14].color.r = 255; nodes[14].color.g = 0; nodes[14].color.b = 0; nodes[14].color.a = 255

        if currentRQ ~= 0 and currentP1 == root.session.visual.currentFaction then
            if currentAction == 1 then nodes[12].color.r = 150; nodes[12].color.g = 150; nodes[12].color.b = 150; names[2] = "Attente"
            elseif currentAction == 2 then nodes[13].color.r = 150; nodes[13].color.g = 150; nodes[13].color.b = 150; names[3] = "Attente" end
        end

        if not hasInitButtonAlign then
            for _, tid in ipairs({ 3, 4, 5, 6, 7, 8, 9, 28, 29 }) do
                pcall(function() nodes[tid].f_setHorizontalAlign(2) end)
                pcall(function() nodes[tid].f_setVerticalAlign(2) end)
            end
            hasInitButtonAlign = true
        end

        local minimapW = 200; local minimapH = 200
        pcall(function() minimapW = root.interface.minimap.nodes[1].sizeX; minimapH = root.interface.minimap.nodes[1].sizeY end)
        
        for i = 1, 6 do
            if (i == 5 or i == 6) and currentP2 == root.session.visual.currentFaction then
                nodes[buttons[i]].visible = true; nodes[buttons[i]].sizeX = 100; nodes[buttons[i]].sizeY = 50
                nodes[buttons[i]].localLeft = (i == 5) and (width // 2 - 120) or (width // 2 + 20)
                nodes[buttons[i]].localTop = height // 2 - 140
                
                nodes[texts[i]].widget_text = names[i]; nodes[texts[i]].sizeX = 100; nodes[texts[i]].sizeY = 50
                nodes[texts[i]].localLeft = 0; nodes[texts[i]].localTop = 0
            elseif i == 5 or i == 6 then
                nodes[buttons[i]].visible = false
            elseif i == 1 and not hideShow then
                nodes[18].visible = true; nodes[18].localLeft = minimapW + 150; nodes[18].localTop = height - minimapH // 2 - 35
                nodes[18].sizeX = 130; nodes[18].sizeY = 50
                
                nodes[9].widget_text = "Menu diplomatie"; nodes[9].sizeX = 130; nodes[9].sizeY = 50
                nodes[9].localLeft = 0; nodes[9].localTop = 0
            elseif i == 1 and hideShow then
                nodes[18].visible = true; nodes[18].localLeft = minimapW + 150; nodes[18].localTop = height - minimapH // 2 - 35
                nodes[18].sizeX = 50; nodes[18].sizeY = 50
                
                nodes[9].widget_text = "X"; nodes[9].sizeX = 50; nodes[9].sizeY = 50
                nodes[9].localLeft = 0; nodes[9].localTop = 0
            else
                nodes[buttons[i]].visible = hideShow; nodes[buttons[i]].localLeft = minimapW + 150 + (i - 1) * 110
                nodes[buttons[i]].localTop = height - minimapH // 2 - 35
                nodes[buttons[i]].sizeX = 100; nodes[buttons[i]].sizeY = 50
                
                nodes[texts[i]].widget_text = names[i]; nodes[texts[i]].sizeX = 100; nodes[texts[i]].sizeY = 50
                nodes[texts[i]].localLeft = 0; nodes[texts[i]].localTop = 0
            end
        end
    end

    if currentMoment % 1000 == 0 and currentRQ ~= 0 then
        if root.session_gameplay_gameplay_time - currentRQ > 10000 then
            SendSystemMsg(getPlayerOfFaction(currentP1), "La demande diplomatique a expiré.")
            RequestNotif.active = false
            currentRQ = 0; currentP1 = -1; currentP2 = -1; currentAction = -1; currentWork = 0
        end
    end
end

-- ============================================================================
-- Logique d'interaction diplomatique et de détermination des événements
-- ============================================================================
function Diplomacy(var)
    local text = getParameter("text")
    local player = getParameter("player")
    
    if getParameter("command") == "finish" then DiplomacyInterface:playSound(finsihSound, 1) end
    if getParameter("command") == "placerButton" then
        if getParameterNumber("button") == 6 then return end
        if getParameterNumber("button") == 7 then
            local intPlayer = getFactionOfPlayer(player)
            if root.session.visual.currentFaction == intPlayer then hideShow = not hideShow end
            return
        end
        
        local scene = root.session_gameplay_gameplay_scene_0
        local landscape = scene.landscape
        local x = getParameter("x"); local y = getParameter("y")
        local btn = getParameter("button")
        local sender = getFactionOfPlayer(player)
        local fac = 0
        pcall(function() fac = landscape.f_getFaction(x, y) end)
        
        if btn == 4 then
            if player == getPlayerOfFaction(currentP2) then
                SystemNotif.active = false; RequestNotif.active = false
                if not TEST_MODE then root.session_visual_commands.f_specialCommand(0,"command","Diplomacy", "action",currentAction,"player1",currentP1,"player2",currentP2)
                else SendSystemMsg(player, "[Version test] Acceptation réussie") end
                
                local name1 = getPlayerName(getPlayerOfFaction(currentP1))
                local name2 = getPlayerName(getPlayerOfFaction(currentP2))
                
                if currentAction == 1 then
                    SendGlobalMsg("Annonce mondiale : " .. name1 .. " s'est allié à " .. name2)
                    showPosition(currentP2, currentP1, "ally")
                else
                    SendGlobalMsg("Annonce mondiale : " .. name1 .. " a signé la paix avec " .. name2)
                    showPosition(currentP2, currentP1, "peace")
                end
                currentRQ = 0; currentP1 = -1; currentP2 = -1; currentAction = -1
            else
                SendSystemMsg(player, "Vous n'avez aucune demande en attente.")
            end
            return
        end
        
        if btn == 5 then
            if player == getPlayerOfFaction(currentP2) then
                SendSystemMsg(getPlayerOfFaction(currentP1), "L'autre joueur a refusé votre demande.")
                currentRQ = 0; currentP1 = -1; currentP2 = -1; currentAction = -1
                RequestNotif.active = false
            else
                SendSystemMsg(player, "Vous n'avez aucune demande en attente.")
            end
            return
        end
        
        if currentRQ ~= 0 then SendSystemMsg(player, "Une demande diplomatique est déjà en attente, veuillez patienter."); return end
        if fac == 255 then SendSystemMsg(player, "Cette action ne peut être effectuée que sur le territoire d'un joueur."); return end
        if sender == fac then
            if not TEST_MODE then SendSystemMsg(player, "Impossible d'effectuer cette action sur votre propre faction."); return
            else SendSystemMsg(player, "[Mode test] Clic sur son propre territoire autorisé pour la simulation") end
        end
        
        if btn == 1 then
            local livess = 0
            for i = 0, root.session.gameplay.gameplay.player.size-1 do
                if not root.session.gameplay.gameplay.player[i].eliminated then livess = livess + 1 end
            end
            if livess < 3 and not TEST_MODE then SendSystemMsg(player, "Au moins 3 joueurs en vie sont nécessaires pour s'allier."); return end
            if checkStatusFrontend(sender, fac) == "Ally" and not TEST_MODE then SendSystemMsg(player, "Vous êtes déjà allié à cette cible."); return end
            if getAllyCount(sender) >= MAX_ALLIES and not TEST_MODE then SendSystemMsg(player, "Vous avez atteint le nombre maximum d'alliés autorisé."); return end
            if getAllyCount(fac) >= MAX_ALLIES and not TEST_MODE then SendSystemMsg(player, "Le joueur cible a atteint le nombre maximum d'alliés."); return end
            
            currentRQ = root.session_gameplay_gameplay_time; currentP1 = sender; currentP2 = fac; currentAction = 1
            
            SendSystemMsg(player, "Demande d'alliance envoyée à l'autre joueur")
            SendRequestMsg(getPlayerOfFaction(fac), "Demande d'alliance reçue de " .. getPlayerName(getPlayerOfFaction(sender)))
            showPosition(fac, sender, "request")
        end
        
        if btn == 2 then
            if checkStatusFrontend(sender, fac) == "Peace" and not TEST_MODE then SendSystemMsg(player, "Vous êtes déjà en paix avec cette cible."); return end
            currentRQ = root.session_gameplay_gameplay_time; currentP1 = sender; currentP2 = fac; currentAction = 2
            
            SendSystemMsg(player, "Demande de paix envoyée à l'autre joueur")
            SendRequestMsg(getPlayerOfFaction(fac), "Demande de paix reçue de " .. getPlayerName(getPlayerOfFaction(sender)))
            showPosition(fac, sender, "request")
        end
        
        if btn == 3 then
            if checkStatusFrontend(sender, fac) == "War" and not TEST_MODE then SendSystemMsg(player, "Vous êtes déjà en guerre avec cette cible."); return end
            if not TEST_MODE then root.session_visual_commands.f_specialCommand(0,"command","Diplomacy", "action",3,"player1",sender,"player2",fac) end
            
            SendGlobalMsg("Annonce mondiale : " .. getPlayerName(getPlayerOfFaction(sender)) .. " a déclaré la guerre à " .. getPlayerName(getPlayerOfFaction(fac)))
            showPosition(fac, sender, "war")
        end
    end
end

-- Lecture du retour sonore
function showPosition(fac, sender, typeR)
    local soundId = 0; local volume = 0.5
    if typeR == "ally" then soundId = allySound; volume = 0.5 elseif typeR == "war" then soundId = warSound; volume = 0.5
    elseif typeR == "peace" then soundId = peaceSound; volume = 0.3 elseif typeR == "request" then soundId = requestSound; volume = 0.4 end
    DiplomacyInterface:playSound(soundId, volume)
end

-- Initialisation de la configuration audio
function SetMusicOnStart()
    DiplomacyInterface = { playSound = function(self, sid, vol) end }
    openingSound = 0; warSound = 0; allySound = 0; peaceSound = 0; requestSound = 0; finsihSound = 0
end

-- Initialisation et chargement du mod
function onInit()
    local isModeReplay = (root.session_gameplay_streamMode == 2)
    if not isModeReplay then
        local parameters = { "x", 1000, "y", 100, "horizontalAlign", 3, "verticalAlign", 0, "cursor", 0, "text1", "text", "text2", "text", "text3", "text" }
        for n = 4, 7 do table.insert(parameters, "placing"..n); table.insert(parameters, false) end
        addInterface("diplomacyInterface", "/project/Tools/placingButtons", nil, nil, parameters)
    end
end

addMod({ onInit = onInit, onTick = updateGamePlay, onSpecialCommand = Diplomacy })