let attackDelay = Date.now();
let didSwing = false;
let attacked = 0;
let attackedPlayers = {};
let attackList = [];
let boxMeshes = [];
let killaurarange, killaurablock, killaurabox, killauraangle, killaurawall, killauraitem;

function wrapAngleTo180_radians(j) {
    return j = j % (2 * Math.PI),
    j >= Math.PI && (j -= 2 * Math.PI),
    j < -Math.PI && (j += 2 * Math.PI),
    j
}

function killauraAttack(entity, first) {
    if (attackDelay < Date.now()) {
        const aimPos = player.pos.clone().sub(entity.pos);
        const newYaw = wrapAngleTo180_radians(Math.atan2(aimPos.x, aimPos.z) - player.lastReportedYawDump);
        const checkYaw = wrapAngleTo180_radians(Math.atan2(aimPos.x, aimPos.z) - player.yaw);
        if (first) sendYaw = Math.abs(checkYaw) > degToRad(30) && Math.abs(checkYaw) < degToRad(killauraangle[1]) ? player.lastReportedYawDump + newYaw : false;
        if (Math.abs(newYaw) < degToRad(30)) {
            if ((attackedPlayers[entity.id] || 0) < Date.now()) attackedPlayers[entity.id] = Date.now() + 100;
            if (!didSwing) {
                hud3D.swingArm();
                ClientSocket.sendPacket(new SPacketClick({}));
                didSwing = true;
            }
            const box = entity.getEntityBoundingBox();
            const hitVec = player.getEyePos().clone().clamp(box.min, box.max);
            attacked++;
            playerControllerMP.syncItemDump();
            ClientSocket.sendPacket(new SPacketUseEntity({
                id: entity.id,
                action: 1,
                hitVec: new PBVector3({
                    x: hitVec.x,
                    y: hitVec.y,
                    z: hitVec.z
                })
            }));
            player.attackDump(entity);
        }
    }
}

function swordCheck() {
    const item = player.inventory.getCurrentItem();
    return item && item.getItem() instanceof ItemSword;
}

function block() {
    if (attackDelay < Date.now()) attackDelay = Date.now() + (Math.round(attacked / 2) * 100);
    if (swordCheck() && killaurablock[1]) {
        if (!blocking) {
            playerControllerMP.syncItemDump();
            ClientSocket.sendPacket(new SPacketUseItem);
            blocking = true;
        }
    } else blocking = false;
}

function unblock() {
    if (blocking && swordCheck()) {
        playerControllerMP.syncItemDump();
        ClientSocket.sendPacket(new SPacketPlayerAction({
            position: BlockPos.ORIGIN.toProto(),
            facing: EnumFacing.DOWN.getIndex(),
            action: PBAction.RELEASE_USE_ITEM
        }));
    }
    blocking = false;
}

function getTeam(entity) {
    const entry = game.playerList.playerDataMap.get(entity.id);
    if (!entry) return;
    return entry.color != "white" ? entry.color : undefined;
}

const killaura = new Module("Killaura", function(callback) {
    if (callback) {
        for(let i = 0; i < 10; i++) {
            const mesh = new Mesh(new boxGeometryDump(1, 2, 1));
            mesh.material.depthTest = false;
            mesh.material.transparent = true;
            mesh.material.opacity = 0.5;
            mesh.material.color.set(255, 0, 0);
            mesh.renderOrder = 6;
            game.gameScene.ambientMeshes.add(mesh);
            boxMeshes.push(mesh);
        }
        tickLoop["Killaura"] = function() {
            attacked = 0;
            didSwing = false;
            const localPos = controls.position.clone();
            const localTeam = getTeam(player);
            const entities = game.world.entitiesDump;

            attackList = [];
            if (!killauraitem[1] || swordCheck()) {
                for (const entity of entities.values()) {
                    if (entity.id == player.id) continue;
                    const newDist = player.getDistanceSqToEntity(entity);
                    if (newDist < (killaurarange[1] * killaurarange[1]) && entity instanceof EntityPlayer) {
                        if (entity.mode.isSpectator() || entity.mode.isCreative() || entity.isInvisibleDump()) continue;
                        if (localTeam && localTeam == getTeam(entity)) continue;
                        if (killaurawall[1] && !player.canEntityBeSeen(entity)) continue;
                        attackList.push(entity);
                    }
                }
            }

            attackList.sort((a, b) => {
                return (attackedPlayers[a.id] || 0) > (attackedPlayers[b.id] || 0) ? 1 : -1;
            });

            for(const entity of attackList) killauraAttack(entity, attackList[0] == entity);

            if (attackList.length > 0) block();
            else {
                unblock();
                sendYaw = false;
            }
        };

        renderTickLoop["Killaura"] = function() {
            for(let i = 0; i < boxMeshes.length; i++) {
                const entity = attackList[i];
                const box = boxMeshes[i];
                box.visible = entity != undefined && killaurabox[1];
                if (box.visible) {
                    const pos = entity.mesh.position;
                    box.position.copy(new Vector3$1(pos.x, pos.y + 1, pos.z));
                }
            }
        };
    }
    else {
        delete tickLoop["Killaura"];
        delete renderTickLoop["Killaura"];
        for(const box of boxMeshes) box.visible = false;
        boxMeshes.splice(boxMeshes.length);
        sendYaw = false;
        unblock();
    }
});
killaurarange = killaura.addoption("Range", Number, 9);
killauraangle = killaura.addoption("Angle", Number, 360);
killaurablock = killaura.addoption("AutoBlock", Boolean, true);
killaurawall = killaura.addoption("Wallcheck", Boolean, false);
killaurabox = killaura.addoption("Box", Boolean, true);
killauraitem = killaura.addoption("LimitToSword", Boolean, false);