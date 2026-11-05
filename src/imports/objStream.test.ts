import { it, expect } from 'vitest';
import { readOBJFile } from './objStream';
import { prepareImport } from './mesh';
it('streams a large indexed OBJ across chunk boundaries without changing faces or units', async () => {
  const prefix = '#' + ' '.repeat(1024 * 1024 - 10) + '\n';
  const file = Object.assign(
    new Blob([
      prefix,
      'v 0 0 0\nv 2 0 0\nv 2 3 0\nv 0 3 0\nf -4/1 -3/2 -2/3 -1/4',
    ]),
    { name: 'wall.obj' },
  );
  const progress: string[] = [];
  const asset = await readOBJFile(file, (s) => progress.push(s));
  expect(asset.indices).toEqual([0, 1, 2, 0, 2, 3]);
  expect(asset.positions).toHaveLength(12);
  expect(progress.length).toBeGreaterThan(1);
  const result = await prepareImport(
    asset,
    { units: 'm', up: 'Y' },
    false,
    false,
  );
  expect(result.dimensions).toEqual({ width: 2, height: 3, depth: 0 });
  expect(result.volumes[0].geometry?.kind).toBe('mesh');
});
it('rejects invalid streamed indices before any project mutation', async () => {
  await expect(
    readOBJFile(
      Object.assign(new Blob(['v 0 0 0\nf 1 2 3']), { name: 'bad.obj' }),
    ),
  ).rejects.toThrow('index');
});

it('streams arbitrarily long comment metadata and resumes geometry after the newline', async () => {
  const file = new File(
    [
      '  #',
      '.'.repeat(10_100_000),
      '\nv 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n#tail',
    ],
    'metadata.obj',
  );
  const asset = await readOBJFile(file);
  expect(asset.sourceTriangles).toBe(1);
  expect(asset.indices).toEqual([0, 1, 2]);
});
