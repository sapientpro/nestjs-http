const assert = require('node:assert/strict');
const { test } = require('node:test');
const { Reflector } = require('@nestjs/core');
const { ApiProperty } = require('@nestjs/swagger');
const { Resource, ResourceMap, ResourcesService } = require('../dist');

// A walk that never ends would otherwise stall the run instead of failing it.
const options = { timeout: 2000 };
const json = (value) => JSON.parse(JSON.stringify(value));

class Wrapped {
  constructor(value) {
    this.value = value;
  }
}

class Short extends Resource {}
ApiProperty()(Short.prototype, 'id');
class Full extends Resource {}
ApiProperty()(Full.prototype, 'id');
ApiProperty()(Full.prototype, 'peer');

const service = () =>
  Object.assign(new ResourcesService(), { reflector: new Reflector() }).addMapper(Wrapped, (wrapped) => wrapped.value);

test('a value shared by several rows is converted in each of them', options, async () => {
  const shared = new Wrapped('secret');
  const list = [1n];
  const rows = [new Full({ id: shared, peer: list }), new Full({ id: shared, peer: list })];

  const row = { id: 'secret', peer: ['1'] };
  assert.deepEqual(json(await service().map(rows)), [row, row]);
});

test('a value kept between responses is converted again, with what it holds now', options, async () => {
  const resources = service();
  const kept = new Wrapped('one');

  assert.deepEqual(await resources.map([kept]), ['one']);
  kept.value = 'two';
  assert.deepEqual(await resources.map([kept]), ['two']);
});

test('two resources over the same data each keep their own shape', options, async () => {
  const data = { id: 1, peer: 'p' };

  const mapped = await service().map([new Short(data), new Full(data), new Short(data)]);

  assert.deepEqual(json(mapped), [{ id: 1 }, { id: 1, peer: 'p' }, { id: 1 }]);
});

test('a value that leads back to itself ends the walk there', options, async () => {
  const array = [1n];
  array.push(array);
  const [first, self] = await service().map(array);
  assert.equal(first, '1');
  assert.equal(self, array);

  const a = new Full({ id: 1 });
  const b = new Full({ id: 2, peer: a });
  a[Object.getOwnPropertySymbols(a)[0]].peer = b;
  const mapped = await service().map([a, b]);
  assert.equal(mapped[0].peer, b);
  assert.equal(mapped[1].peer, a);

  const looping = new ResourcesService().addMapper(Wrapped, (wrapped) => [wrapped.value, wrapped]);
  const wrapped = new Wrapped(1n);
  assert.deepEqual(await looping.map(wrapped), ['1', wrapped]);
});

test('what a ResourceMap returns is converted, and runs once for a resource held by several rows', options, async () => {
  let runs = 0;
  class Counted extends Resource {}
  ApiProperty()(Counted.prototype, 'id');
  ResourceMap({ map: (data) => ({ run: ++runs, big: 5n, wrapped: new Wrapped(data.id) }) })(Counted);

  const one = new Counted({ id: 1 });
  const mapped = await service().map([one, one, [one]]);

  const row = { id: 1, run: 1, big: '5', wrapped: 1 };
  assert.deepEqual(json(mapped), [row, row, [row]]);
});

test('a mapper going back through the service still ends on a value that holds itself', options, async () => {
  const resources = new ResourcesService();
  resources.addMapper(Wrapped, (wrapped) => resources.map(wrapped.value));
  const wrapped = new Wrapped(null);
  wrapped.value = [wrapped];

  assert.deepEqual(await resources.map(wrapped), [wrapped]);
});
