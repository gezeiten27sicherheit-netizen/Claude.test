// Shared AABB-vs-voxel collision helpers used by the player and mobs.
(function () {
  function aabbBlocked(world, x, y, z, halfWidth, height) {
    const minX = Math.floor(x - halfWidth), maxX = Math.floor(x + halfWidth);
    const minY = Math.floor(y + 0.01), maxY = Math.floor(y + height - 0.01);
    const minZ = Math.floor(z - halfWidth), maxZ = Math.floor(z + halfWidth);
    for (let by = minY; by <= maxY; by++) {
      for (let bz = minZ; bz <= maxZ; bz++) {
        for (let bx = minX; bx <= maxX; bx++) {
          if (world.isSolid(bx, by, bz)) return true;
        }
      }
    }
    return false;
  }

  // Moves an entity's feet-position `pos` by vel*dt, axis by axis, sliding along
  // obstacles and reporting whether it ended the frame standing on solid ground.
  function moveWithCollision(world, pos, vel, halfWidth, height, dt) {
    let onGround = false;

    // Horizontal (X then Z), each nudged back to the collision boundary if blocked.
    const dx = vel.x * dt;
    if (dx !== 0) {
      let tx = pos.x + dx;
      if (aabbBlocked(world, tx, pos.y, pos.z, halfWidth, height)) {
        const step = dx > 0 ? -0.02 : 0.02;
        let guard = 0;
        while (aabbBlocked(world, tx, pos.y, pos.z, halfWidth, height) && guard++ < 40) tx += step;
        vel.x = 0;
      }
      pos.x = tx;
    }

    const dz = vel.z * dt;
    if (dz !== 0) {
      let tz = pos.z + dz;
      if (aabbBlocked(world, pos.x, pos.y, tz, halfWidth, height)) {
        const step = dz > 0 ? -0.02 : 0.02;
        let guard = 0;
        while (aabbBlocked(world, pos.x, pos.y, tz, halfWidth, height) && guard++ < 40) tz += step;
        vel.z = 0;
      }
      pos.z = tz;
    }

    // Vertical.
    const dy = vel.y * dt;
    let ty = pos.y + dy;
    if (aabbBlocked(world, pos.x, ty, pos.z, halfWidth, height)) {
      const step = dy > 0 ? -0.02 : 0.02;
      let guard = 0;
      while (aabbBlocked(world, pos.x, ty, pos.z, halfWidth, height) && guard++ < 60) ty += step;
      if (dy < 0) onGround = true;
      vel.y = 0;
    }
    pos.y = ty;

    if (!onGround && aabbBlocked(world, pos.x, pos.y - 0.05, pos.z, halfWidth, height)) onGround = true;
    return onGround;
  }

  window.G = window.G || {};
  window.G.aabbBlocked = aabbBlocked;
  window.G.moveWithCollision = moveWithCollision;
})();
