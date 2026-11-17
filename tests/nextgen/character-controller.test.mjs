import test from 'node:test';
import assert from 'node:assert/strict';
import { CharacterController } from '../../src/nextgen/core/CharacterController.ts';
import { TerrainGenerator } from '../../src/nextgen/core/TerrainGenerator.ts';

const camera = {
  front: [0, 0, -1],
  right: [1, 0, 0],
};

const flatTerrain = {
  size: 200,
  heightAt: () => 0,
};

function createController(options = {}) {
  return new CharacterController({
    speed: 5,
    radius: 2,
    terrain: flatTerrain,
    ...options,
  });
}

function near(actual, expected, epsilon = 0.000001) {
  assert.ok(
    Math.abs(actual - expected) <= epsilon,
    `Expected ${expected}, got ${actual}`
  );
}

function vectorNear(actual, expected) {
  for (let i = 0; i < 3; i++) {
    near(actual[i], expected[i]);
  }
}

test('Default spawn is at terrain center', () => {
  const terrain = new TerrainGenerator(42);
  const controller = createController({ terrain });

  vectorNear(controller.getPosition(), [
    100,
    terrain.heightAt(100, 100),
    100,
  ]);
});

test('Custom spawn respects character radius', () => {
  const controller = createController({
    spawn: { x: -10, z: 250 },
  });

  vectorNear(controller.getPosition(), [2, 0, 198]);
});

test('Forward and backward movement have exact displacement', () => {
  const controller = createController();

  let result = controller.update(
    100, { forward: 1, strafe: 0 }, camera
  );

  vectorNear(result.position, [100, 0, 99.5]);

  result = controller.update(
    100, { forward: -1, strafe: 0 }, camera
  );

  vectorNear(result.position, [100, 0, 100]);
});

test('Left and right movement have exact displacement', () => {
  const controller = createController();

  let result = controller.update(
    100, { forward: 0, strafe: 1 }, camera
  );

  vectorNear(result.position, [100.5, 0, 100]);

  result = controller.update(
    100, { forward: 0, strafe: -1 }, camera
  );

  vectorNear(result.position, [100, 0, 100]);
});

test('Movement follows rotated camera orientation', () => {
  const controller = createController();

  const result = controller.update(
    100,
    { forward: 1, strafe: 0 },
    {
      front: [1, 0, 0],
      right: [0, 0, 1],
    }
  );

  vectorNear(result.position, [100.5, 0, 100]);
});

test('Camera pitch does not reduce movement speed', () => {
  const controller = createController();

  const result = controller.update(
    100,
    { forward: 1, strafe: 0 },
    {
      front: [0, -0.8, -0.6],
      right: [1, 0, 0],
    }
  );

  vectorNear(result.position, [100, 0, 99.5]);
});

test('Vertical camera uses horizontal right vector safely', () => {
  const controller = createController();

  const result = controller.update(
    100,
    { forward: 1, strafe: 0 },
    {
      front: [0, -1, 0],
      right: [1, 0, 0],
    }
  );

  vectorNear(result.position, [100, 0, 99.5]);
});

test('Diagonal movement is normalized', () => {
  const controller = createController();

  const result = controller.update(
    100, { forward: 1, strafe: 1 }, camera
  );

  const offset = 0.5 / Math.sqrt(2);

  vectorNear(result.position, [
    100 + offset,
    0,
    100 - offset,
  ]);

  near(
    Math.hypot(
      result.position[0] - 100,
      result.position[2] - 100
    ),
    0.5
  );
});

test('Analog movement preserves partial input strength', () => {
  const controller = createController();

  const result = controller.update(
    100, { forward: 0.5, strafe: 0.5 }, camera
  );

  vectorNear(result.position, [100.25, 0, 99.75]);
});

test('All four terrain boundaries enforce radius', () => {
  const cases = [
    [{ forward: 0, strafe: -1 }, [2, 0, 100]],
    [{ forward: 0, strafe: 1 }, [198, 0, 100]],
    [{ forward: 1, strafe: 0 }, [100, 0, 2]],
    [{ forward: -1, strafe: 0 }, [100, 0, 198]],
  ];

  for (const [input, expected] of cases) {
    const controller = createController({ speed: 10 });

    for (let i = 0; i < 120; i++) {
      controller.update(100, input, camera);
    }

    vectorNear(controller.getPosition(), expected);
  }
});

test('Movement follows actual terrain elevation', () => {
  const terrain = new TerrainGenerator(42);
  const controller = createController({ terrain });

  for (let i = 0; i < 120; i++) {
    const result = controller.update(
      100,
      { forward: 1, strafe: 0.5 },
      camera
    );

    const [x, y, z] = result.position;

    near(y, terrain.heightAt(x, z));
    assert.equal(result.grounded, true);
  }
});

test('Invalid input axes cannot corrupt position', () => {
  const controller = createController();
  const initial = controller.getPosition();

  controller.update(
    100,
    { forward: NaN, strafe: Infinity },
    camera
  );

  assert.deepEqual(controller.getPosition(), initial);
});

test('Invalid and degenerate camera vectors are safe', () => {
  const controller = createController();
  const initial = controller.getPosition();

  const invalidCameras = [
    { front: [NaN, 0, -1], right: [1, 0, 0] },
    { front: [0, 0, -1], right: [Infinity, 0, 0] },
    { front: [0, 0, 0], right: [0, 0, 0] },
  ];

  for (const orientation of invalidCameras) {
    controller.update(
      100,
      { forward: 1, strafe: 1 },
      orientation
    );

    assert.deepEqual(controller.getPosition(), initial);
  }
});

test('Invalid delta times cannot move character', () => {
  const controller = createController();
  const initial = controller.getPosition();

  for (const dt of [-100, NaN, Infinity, 0]) {
    controller.update(
      dt,
      { forward: 1, strafe: 1 },
      camera
    );

    assert.deepEqual(controller.getPosition(), initial);
  }
});

test('Large delta time is capped', () => {
  const controller = createController();

  const result = controller.update(
    5000, { forward: 1, strafe: 0 }, camera
  );

  const distance =
    5 * CharacterController.MAX_STEP_MS / 1000;

  vectorNear(result.position, [
    100,
    0,
    100 - distance,
  ]);
});

test('Facing updates during movement and persists when idle', () => {
  const controller = createController();

  let result = controller.update(
    100, { forward: 0, strafe: 1 }, camera
  );

  vectorNear(result.facing, [1, 0, 0]);

  const position = [...result.position];

  result = controller.update(
    100, { forward: 0, strafe: 0 }, camera
  );

  vectorNear(result.position, position);
  vectorNear(result.facing, [1, 0, 0]);
});

test('Returned vectors cannot mutate internal state', () => {
  const controller = createController();

  const result = controller.update(
    100, { forward: 1, strafe: 0 }, camera
  );

  const position = controller.getPosition();
  const facing = controller.getFacing();

  result.position[0] = 999;
  result.facing[2] = 999;

  controller.getPosition()[0] = 888;
  controller.getFacing()[2] = 888;

  assert.deepEqual(controller.getPosition(), position);
  assert.deepEqual(controller.getFacing(), facing);
});

test('Invalid constructor parameters are rejected', () => {
  assert.throws(
    () => createController({ speed: NaN }),
    RangeError
  );

  assert.throws(
    () => createController({ speed: -1 }),
    RangeError
  );

  assert.throws(
    () => createController({ radius: Infinity }),
    RangeError
  );

  assert.throws(
    () => createController({ radius: 101 }),
    RangeError
  );

  assert.throws(
    () => createController({
      terrain: { size: 0, heightAt: () => 0 },
    }),
    RangeError
  );
});

test('Invalid terrain height preserves last valid position', () => {
  let valid = true;

  const controller = createController({
    terrain: {
      size: 200,
      heightAt: () => valid ? 5 : NaN,
    },
  });

  const initial = controller.getPosition();

  valid = false;

  let result = controller.update(
    100, { forward: 1, strafe: 0 }, camera
  );

  assert.deepEqual(result.position, initial);
  assert.equal(result.grounded, false);

  valid = true;

  result = controller.update(
    100, { forward: 1, strafe: 0 }, camera
  );

  assert.equal(result.grounded, true);
  vectorNear(result.position, [100, 5, 99.5]);
});

test('Identical inputs produce deterministic movement', () => {
  const a = createController({
    terrain: new TerrainGenerator(42),
  });

  const b = createController({
    terrain: new TerrainGenerator(42),
  });

  for (let i = 0; i < 120; i++) {
    const input = {
      forward: Math.sin(i),
      strafe: Math.cos(i),
    };

    const first = a.update(1000 / 60, input, camera);
    const second = b.update(1000 / 60, input, camera);

    assert.deepEqual(first, second);
  }
});