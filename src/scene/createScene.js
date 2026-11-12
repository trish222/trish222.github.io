import * as THREE from 'three';
import { buildFog, buildRoom } from '../room.js';
import { buildComputer, COMPUTER_FRONT_Z as KIT_Z_MAX } from '../computer.js';
import { buildTreehouse, buildSpareBricks } from '../treehouse.js';
import { buildNameplate } from '../nameplate.js';

// Model placement in the original desk-front reference frame.
const AZIMUTH = THREE.MathUtils.degToRad(37);
const KIT_FRONT_Z = 5.985;
const TREEHOUSE_X = 8.1;
const TREEHOUSE_Z = -2.1;
const TREEHOUSE_FACING = AZIMUTH - 0.50;
const TREEHOUSE_SCALE = 1.1733;
const SPARES_X = 1.2;
const NAMEPLATE_X = -8.2;
const NAMEPLATE_Z = 0.6;
const NAMEPLATE_FACING = AZIMUTH * 0.26;
const NAMEPLATE_NAME = "Trish Nguyen";
const LAMP_X = -7.0;
const LAMP_Z = -3.6;

export function createRoomScene({ renderer, deskMod, lampMod, reducedMotion, fogDistance, screenGlowBase, scenery }) {
  const s = new THREE.Scene();
  let room, desk, computer, treehouse, nameplate, lamp;
  const top = deskMod.DESK_TOP;
  const DESK_TOP_Y = deskMod.DESK_TOP_Y;
  const SEAT_DX = top.X;
  const SEAT_DZ = top.Z + top.D / 2 - 6.3;
  const COMPUTER_Z = SEAT_DZ + KIT_FRONT_Z - KIT_Z_MAX;

  s.fog = buildFog(fogDistance);

  room = buildRoom(
    renderer.capabilities.getMaxAnisotropy(),
    reducedMotion,
    { scenery },
  );
  s.add(room.root);

  desk = deskMod.buildDesk();
  desk.root.name = "desk";
  s.add(desk.root);

  computer = buildComputer(renderer.capabilities.getMaxAnisotropy());
  computer.root.name = "computer";

  computer.screenGlow.intensity = screenGlowBase;
  computer.root.position.set(SEAT_DX, DESK_TOP_Y, COMPUTER_Z);
  s.add(computer.root);

  treehouse = buildTreehouse();
  treehouse.root.name = "treehouse";
  treehouse.root.position.set(
    SEAT_DX + TREEHOUSE_X, DESK_TOP_Y, SEAT_DZ + TREEHOUSE_Z);
  treehouse.root.rotation.y = TREEHOUSE_FACING;
  treehouse.root.scale.setScalar(TREEHOUSE_SCALE);
  s.add(treehouse.root);

  const spares = buildSpareBricks();
  spares.name = "spares";
  spares.position.set(SEAT_DX + SPARES_X, DESK_TOP_Y, SEAT_DZ);
  s.add(spares);

  nameplate = buildNameplate(
    NAMEPLATE_NAME,
    renderer.capabilities.getMaxAnisotropy(),
  );
  nameplate.root.name = "nameplate";
  nameplate.root.position.set(
    SEAT_DX + NAMEPLATE_X, DESK_TOP_Y, SEAT_DZ + NAMEPLATE_Z);
  nameplate.root.rotation.y = NAMEPLATE_FACING;
  s.add(nameplate.root);

  lamp = lampMod.buildLamp();

  lamp.root.position.set(
    SEAT_DX + (lampMod.LAMP_X ?? LAMP_X),
    DESK_TOP_Y,
    SEAT_DZ + (lampMod.LAMP_Z ?? LAMP_Z),
  );
  s.add(lamp.root);

  return { scene: s, room, desk, computer, treehouse, nameplate, lamp, deskTopY: DESK_TOP_Y };
}

