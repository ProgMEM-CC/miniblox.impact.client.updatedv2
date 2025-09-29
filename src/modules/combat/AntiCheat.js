new Module("AntiCheat", function(callback) {
    if (!callback)
        return; 
    const entities = game.world.entitiesDump;
    for (const entity of entities) {
        if (!entity instanceof EntityPlayer)
            continue; 
        if (entity.mode.isCreative() || entity.mode.isSpectator())
            continue; 
    }
});